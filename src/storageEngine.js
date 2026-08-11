import { Api } from "telegram";
import { getClient } from "./telegramClient";
import { db } from "./firebase";
import { ref, set, get, child, remove } from "firebase/database";
import { CustomFile } from "telegram/client/uploads";
import bigInt from "big-integer";

// Module‑level cache for storage channel per user to avoid DB round‑trip on each upload
const channelCache = {};

// 1. Channel Management
export const setupStorageChannel = async (userId) => {
  const client = getClient();
  if (!client) throw new Error("Client not initialized");

  // Check if channel already exists in Firebase
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, `users/${userId}/storageChannel`));
  
  if (snapshot.exists()) {
    return snapshot.val();
  }

  // Create a new channel
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: "InfinityDrive Storage",
      about: "Unlimited storage channel. DO NOT DELETE.",
      broadcast: true,
      megagroup: false,
    })
  );

  const channelId = result.chats[0].id.toString();

  // Mute and Archive the channel
  await client.invoke(
    new Api.account.UpdateNotifySettings({
      peer: new Api.InputNotifyPeer({ peer: new Api.InputPeerChannel({ channelId: result.chats[0].id, accessHash: result.chats[0].accessHash }) }),
      settings: new Api.InputPeerNotifySettings({ muteUntil: 2147483647 }),
    })
  );

  await client.invoke(
    new Api.folders.EditPeerFolders({
      folderPeers: [
        new Api.InputFolderPeer({
          peer: new Api.InputPeerChannel({ channelId: result.chats[0].id, accessHash: result.chats[0].accessHash }),
          folderId: 1, // 1 is usually the ID for Archive
        }),
      ],
    })
  );

  // Save to Firebase
  await set(ref(db, `users/${userId}/storageChannel`), {
    channelId,
    accessHash: result.chats[0].accessHash.toString()
  });

  return { channelId, accessHash: result.chats[0].accessHash.toString() };
};

// 2. Upload Engine (with chunking for files > 2GB)
const CHUNK_SIZE = 1024 * 1024 * 1024 * 1.9; // ~1.9GB chunks

// How many parts to upload simultaneously.
// Too high concurrency on a single connection causes socket buffer bloat and MTProto timeouts.
// We are using 6 as per user request.
const PARALLEL_PARTS = 6;

// Custom chunk upload using the main connection to prevent AUTH_KEY_DUPLICATED error
const uploadFileCustom = async (client, file, onProgress, checkCancelled) => {
  const isBig = file.size > 10 * 1024 * 1024; // > 10MB
  const partSize = 512 * 1024; // 512KB — Telegram's max allowed part size
  const totalParts = Math.ceil(file.size / partSize) || 1;
  const fileId = bigInt.randBetween(bigInt(0), bigInt("9223372036854775807"));

  let uploadedParts = 0;
  let nextPartIndex = 0;
  let hasError = false;

  // A worker function that continually pulls the next part to upload
  const worker = async () => {
    while (nextPartIndex < totalParts && !hasError) {
      if (checkCancelled && checkCancelled()) {
        hasError = true;
        throw new Error("UPLOAD_CANCELLED");
      }

      const part = nextPartIndex++; // Claim the part
      
      const start = part * partSize;
      const end = Math.min(start + partSize, file.size);
      
      try {
        const arrayBuffer = await file.slice(start, end).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (isBig) {
          await client.invoke(
            new Api.upload.SaveBigFilePart({
              fileId,
              filePart: part,
              fileTotalParts: totalParts,
              bytes,
            })
          );
        } else {
          await client.invoke(
            new Api.upload.SaveFilePart({
              fileId,
              filePart: part,
              bytes,
            })
          );
        }

        uploadedParts++;
        if (onProgress) onProgress(uploadedParts / totalParts);
      } catch (err) {
        hasError = true; // Stop other workers
        throw err;
      }
    }
  };

  // Spawn PARALLEL_PARTS workers
  const workers = [];
  for (let i = 0; i < Math.min(PARALLEL_PARTS, totalParts); i++) {
    workers.push(worker());
  }

  // Wait for all workers to finish
  await Promise.all(workers);

  if (isBig) {
    return new Api.InputFileBig({
      id: fileId,
      parts: totalParts,
      name: file.name,
    });
  } else {
    return new Api.InputFile({
      id: fileId,
      parts: totalParts,
      name: file.name,
      md5Checksum: "",
    });
  }
};


export const uploadFile = async (userId, file, customName, uploadId, onProgress, checkCancelled) => {



  const client = getClient();
  if (!client) throw new Error("Client not initialized");

  // Connect only if not already connected (GramJS sets .connected flag)
  if (!client.connected) {
    await client.connect();
  }


  const dbRef = ref(db);
  // Try cached channel first
  let channelData = channelCache[userId];
  if (!channelData) {
    const snapshot = await get(child(dbRef, `users/${userId}/storageChannel`));
    if (!snapshot.exists()) {
      channelData = await setupStorageChannel(userId);
    } else {
      channelData = snapshot.val();
    }
    // Cache it for future uploads
    channelCache[userId] = channelData;
  }

  // Removed the 5% bump as per user request
  const peer = new Api.InputPeerChannel({
    channelId: bigInt(channelData.channelId),
    accessHash: bigInt(channelData.accessHash)
  });

  const finalName = customName || file.name;
  
  // Update record in Firebase to 'uploading' (entry may already exist as 'queued')
  await set(ref(db, `users/${userId}/files/${uploadId}`), {
    name: finalName,
    originalName: file.name,
    size: file.size,
    type: file.type,
    isChunked: file.size > CHUNK_SIZE,
    status: 'uploading',
    createdAt: Date.now()
  });

  try {
    if (file.size <= CHUNK_SIZE) {
      const uploadedFile = await uploadFileCustom(client, file, (progress) => {
        if(onProgress) onProgress(progress * 100);
      }, checkCancelled);

      const message = await client.invoke(
        new Api.messages.SendMedia({
          peer,
          media: new Api.InputMediaUploadedDocument({
            file: uploadedFile,
            mimeType: file.type || "application/octet-stream",
            attributes: [new Api.DocumentAttributeFilename({ fileName: finalName })],
          }),
          message: `File: ${finalName}`,
        })
      );
      
      let messageId = Date.now().toString();
      if (message.updates) {
        const msgUpdate = message.updates.find(u => u.message && u.message.id);
        if (msgUpdate) messageId = msgUpdate.message.id.toString();
      }
      
      await set(ref(db, `users/${userId}/files/${uploadId}`), {
        name: finalName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        messageId: messageId,
        isChunked: false,
        status: 'done',
        createdAt: Date.now()
      });
      return true;
    } else {
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      let chunkMessageIds = [];
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);
        const chunkFile = new File([blob], `${finalName}.part${i+1}`);
        
        const uploadedFile = await uploadFileCustom(client, chunkFile, (progress) => {
          const overallProgress = ((i + progress) / chunks) * 100;
          if(onProgress) onProgress(overallProgress);
        }, checkCancelled);

        const message = await client.invoke(
          new Api.messages.SendMedia({
            peer,
            media: new Api.InputMediaUploadedDocument({
              file: uploadedFile,
              mimeType: "application/octet-stream",
              attributes: [new Api.DocumentAttributeFilename({ fileName: chunkFile.name })],
            }),
            message: `Chunk ${i+1}/${chunks} for ${finalName}`,
          })
        );
        
        let chunkId = Date.now().toString() + i;
        if (message.updates) {
          const msgUpdate = message.updates.find(u => u.message && u.message.id);
          if (msgUpdate) chunkId = msgUpdate.message.id.toString();
        }
        chunkMessageIds.push(chunkId);
      }
      
      await set(ref(db, `users/${userId}/files/${uploadId}`), {
        name: finalName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        chunkIds: chunkMessageIds,
        isChunked: true,
        status: 'done',
        createdAt: Date.now()
      });
      return true;
    }
  } catch (err) {
    if (err.message === "UPLOAD_CANCELLED") {
      await remove(ref(db, `users/${userId}/files/${uploadId}`));
    } else {
      await set(ref(db, `users/${userId}/files/${uploadId}/status`), 'error');
    }
    throw err;
  }
};

// 3. Download Engine
export const downloadFile = async (userId, fileData, onProgress) => {
  const client = getClient();
  if (!client) throw new Error("Client not initialized. Please login first.");
  
  if (!client.connected) await client.connect();
  
  // Get channel data
  let channelData = channelCache[userId];
  if (!channelData) {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${userId}/storageChannel`));
    if (!snapshot.exists()) throw new Error("Storage channel not found");
    channelData = snapshot.val();
    channelCache[userId] = channelData;
  }

  const peer = new Api.InputPeerChannel({
    channelId: bigInt(channelData.channelId),
    accessHash: bigInt(channelData.accessHash)
  });

  if (!fileData.isChunked) {
    // Single file download
    const messageId = parseInt(fileData.messageId);
    const result = await client.invoke(
      new Api.channels.GetMessages({
        channel: peer,
        id: [new Api.InputMessageID({ id: messageId })]
      })
    );
    
    const message = result.messages[0];
    if (!message || !message.media) throw new Error("Message or media not found");
    
    const buffer = await client.downloadMedia(message.media, {
      progressCallback: (downloaded, total) => {
        if (onProgress && total) onProgress((downloaded / total) * 100);
      }
    });
    
    return buffer;
  } else {
    // Chunked file download - download each chunk and combine
    const chunkIds = fileData.chunkIds;
    const buffers = [];
    
    for (let i = 0; i < chunkIds.length; i++) {
      const messageId = parseInt(chunkIds[i]);
      const result = await client.invoke(
        new Api.channels.GetMessages({
          channel: peer,
          id: [new Api.InputMessageID({ id: messageId })]
        })
      );
      
      const message = result.messages[0];
      if (!message || !message.media) throw new Error(`Chunk ${i+1} not found`);
      
      const buffer = await client.downloadMedia(message.media, {
        progressCallback: (downloaded, total) => {
          if (onProgress && total) {
            const chunkProgress = (downloaded / total) * 100;
            const overall = ((i * 100) + chunkProgress) / chunkIds.length;
            onProgress(overall);
          }
        }
      });
      buffers.push(buffer);
    }
    
    // Merge all chunks
    const totalSize = buffers.reduce((acc, buf) => acc + buf.length, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const buf of buffers) {
      merged.set(new Uint8Array(buf), offset);
      offset += buf.length;
    }
    return merged.buffer;
  }
};
