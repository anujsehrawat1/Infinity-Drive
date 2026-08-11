import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(import.meta.env.VITE_TELEGRAM_API_ID);
const apiHash = import.meta.env.VITE_TELEGRAM_API_HASH;

// Global client instance to survive Vite HMR
let client = window.__tgClient || null;

export const initTelegramClient = async (savedSession = "") => {
  if (client) return client;
  
  const stringSession = new StringSession(savedSession);
  
  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  window.__tgClient = client;
  
  return client;
};

export const getClient = () => client;

export const sendCode = async (phoneNumber) => {
  if (!client) await initTelegramClient();
  await client.connect();
  const result = await client.sendCode(
    {
      apiId,
      apiHash,
    },
    phoneNumber
  );
  return result.phoneCodeHash;
};

export const signIn = async (phoneNumber, phoneCodeHash, code) => {
  if (!client) throw new Error("Client not initialized");
  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber,
      phoneCodeHash,
      phoneCode: code,
    })
  );
  // Generate session string to save in Firebase
  return client.session.save();
};

export const checkPassword = async (password) => {
  if (!client) throw new Error("Client not initialized");
  await client.signInWithPassword(
    { apiId, apiHash },
    {
      password: async () => password,
      onError: (err) => {
        console.error("2FA Error:", err);
        throw err; // Break the infinite loop and return real error to UI
      },
    }
  );
  return client.session.save();
};
