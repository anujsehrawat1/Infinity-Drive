import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { ref, get, child, onValue } from 'firebase/database';
import { HardDrive, Download, Loader2, AlertCircle, FileText, Clock, Database, Layers, Shield, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { formatBytes } from '../utils/format';
import { downloadFile } from '../storageEngine';
import { getClient } from '../telegramClient';

const DownloadPage = () => {
  const { userId, fileId } = useParams();
  const navigate = useNavigate();
  const [fileData, setFileData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    // Use onValue for live updates (so uploading -> done transition is real-time)
    const fileRef = ref(db, `users/${userId}/files/${fileId}`);
    const unsubscribe = onValue(fileRef, (snapshot) => {
      if (snapshot.exists()) {
        setFileData(snapshot.val());
        setError(null);
      } else {
        setError("FILE_NOT_FOUND");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("ERROR");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, fileId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    const client = getClient();
    if (!client || !client.connected) {
      setDownloadError("You must be logged in to InfinityDrive to download files. Please login first.");
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      const buffer = await downloadFile(userId, fileData, (progress) => {
        setDownloadProgress(progress);
      });

      // Create blob and trigger download
      const blob = new Blob([buffer], { type: fileData.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileData.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getFileExtension = (name) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
  };

  const getFileCategory = (type) => {
    if (!type) return 'Unknown';
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.startsWith('text/')) return 'Document';
    if (type.includes('pdf')) return 'PDF Document';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar')) return 'Archive';
    if (type.includes('word') || type.includes('document')) return 'Word Document';
    if (type.includes('sheet') || type.includes('excel')) return 'Spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'Presentation';
    return 'File';
  };

  const formatDate = (ts) => {
    if (!ts) return 'Unknown';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTimeSince = (ts) => {
    if (!ts) return 'Unknown';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };

  // --- STYLES ---
  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#f0f4f8',
      fontFamily: 'Inter, -apple-system, sans-serif',
    },
    header: {
      backgroundColor: '#fff',
      borderBottom: '1px solid #e2e8f0',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 700,
      fontSize: '18px',
      color: '#1a202c',
      cursor: 'pointer',
      textDecoration: 'none',
    },
    container: {
      maxWidth: '800px',
      margin: '40px auto',
      padding: '0 24px',
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '32px 32px 24px',
      borderBottom: '1px solid #f1f5f9',
    },
    fileIcon: {
      width: '64px',
      height: '64px',
      borderRadius: '16px',
      backgroundColor: 'rgba(51, 144, 236, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '20px',
    },
    fileName: {
      fontSize: '24px',
      fontWeight: 700,
      color: '#1a202c',
      marginBottom: '8px',
      wordBreak: 'break-word',
      lineHeight: 1.3,
    },
    fileSub: {
      fontSize: '14px',
      color: '#718096',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 600,
    },
    detailsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1px',
      backgroundColor: '#f1f5f9',
    },
    detailItem: {
      backgroundColor: '#fff',
      padding: '20px 32px',
    },
    detailLabel: {
      fontSize: '11px',
      fontWeight: 700,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '6px',
    },
    detailValue: {
      fontSize: '15px',
      fontWeight: 600,
      color: '#1a202c',
    },
    actions: {
      padding: '24px 32px',
      borderTop: '1px solid #f1f5f9',
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
    },
    downloadBtn: {
      flex: 1,
      backgroundColor: '#3390ec',
      color: '#fff',
      border: 'none',
      padding: '14px 24px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      transition: 'background-color 0.2s',
    },
    secondaryBtn: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: 'none',
      padding: '14px 20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'background-color 0.2s',
    },
    uploadingBanner: {
      margin: '24px 32px',
      padding: '24px',
      backgroundColor: 'rgba(51, 144, 236, 0.06)',
      borderRadius: '12px',
      border: '1px solid rgba(51, 144, 236, 0.15)',
      textAlign: 'center',
    },
    progressContainer: {
      padding: '0 32px 24px',
    },
    progressBar: {
      height: '8px',
      backgroundColor: '#e2e8f0',
      borderRadius: '100px',
      overflow: 'hidden',
      marginBottom: '8px',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#3390ec',
      borderRadius: '100px',
      transition: 'width 0.3s ease',
    },
    errorBox: {
      margin: '16px 32px 0',
      padding: '16px',
      backgroundColor: '#fef2f2',
      borderRadius: '10px',
      border: '1px solid #fecaca',
      color: '#dc2626',
      fontSize: '14px',
      lineHeight: 1.5,
    },
    footer: {
      textAlign: 'center',
      padding: '32px',
      color: '#94a3b8',
      fontSize: '13px',
    },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f4f8' }}>
        <Loader2 className="spinner" size={48} color="#3390ec" />
      </div>
    );
  }

  if (error === "FILE_NOT_FOUND" || error === "ERROR") {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <span style={styles.brand} onClick={() => navigate('/')}>
            <HardDrive size={22} color="#3390ec" /> InfinityDrive
          </span>
        </div>
        <div style={styles.container}>
          <div style={{ ...styles.card, textAlign: 'center', padding: '60px 32px' }}>
            <AlertCircle size={56} color="#e53935" style={{ marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1a202c', marginBottom: '12px' }}>
              {error === 'FILE_NOT_FOUND' ? 'File Not Found' : 'Something Went Wrong'}
            </h2>
            <p style={{ color: '#718096', fontSize: '15px', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto 32px' }}>
              {error === 'FILE_NOT_FOUND'
                ? 'This file may have been deleted or the link is invalid. Please check the URL and try again.'
                : 'An unexpected error occurred while loading this file. Please try again later.'}
            </p>
            <button
              style={{ ...styles.downloadBtn, maxWidth: '220px', margin: '0 auto' }}
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={18} /> Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ext = getFileExtension(fileData.name);
  const category = getFileCategory(fileData.type);
  const isUploading = fileData.status === 'uploading' || fileData.status === 'queued' || fileData.status === 'stuck';

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.brand} onClick={() => navigate('/')}>
          <HardDrive size={22} color="#3390ec" /> InfinityDrive
        </span>
        <button
          style={styles.secondaryBtn}
          onClick={handleCopyLink}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
        >
          {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Main Content */}
      <div style={styles.container}>
        <div style={styles.card}>
          {/* File Header */}
          <div style={styles.cardHeader}>
            <div style={styles.fileIcon}>
              <FileText size={32} color="#3390ec" />
            </div>
            <div style={styles.fileName}>{fileData.name}</div>
            <div style={styles.fileSub}>
              <span style={{ ...styles.badge, backgroundColor: 'rgba(51,144,236,0.1)', color: '#3390ec' }}>
                .{ext.toLowerCase()}
              </span>
              <span style={{ ...styles.badge, backgroundColor: '#f1f5f9', color: '#64748b' }}>
                {category}
              </span>
              {isUploading && (
                <span style={{ ...styles.badge, backgroundColor: '#fef3c7', color: '#d97706' }}>
                  ⏳ Uploading
                </span>
              )}
              {!isUploading && (
                <span style={{ ...styles.badge, backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  ✓ Ready
                </span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>File Size</div>
              <div style={styles.detailValue}>{formatBytes(fileData.size)}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>MIME Type</div>
              <div style={styles.detailValue}>{fileData.type || 'application/octet-stream'}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Original Name</div>
              <div style={styles.detailValue}>{fileData.originalName || fileData.name}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Extension</div>
              <div style={styles.detailValue}>.{ext.toLowerCase()}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Uploaded On</div>
              <div style={styles.detailValue}>{formatDate(fileData.createdAt)}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Time Since Upload</div>
              <div style={styles.detailValue}>{getTimeSince(fileData.createdAt)}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Storage Type</div>
              <div style={styles.detailValue}>{fileData.isChunked ? 'Multi-Chunk' : 'Single File'}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Status</div>
              <div style={{ ...styles.detailValue, color: isUploading ? '#d97706' : '#16a34a' }}>
                {isUploading ? 'Upload in Progress' : 'Available'}
              </div>
            </div>
            {fileData.isChunked && fileData.chunkIds && (
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Chunks</div>
                <div style={styles.detailValue}>{fileData.chunkIds.length} parts</div>
              </div>
            )}
            {fileData.messageId && (
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Message ID</div>
                <div style={styles.detailValue}>#{fileData.messageId}</div>
              </div>
            )}
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>File ID</div>
              <div style={{ ...styles.detailValue, fontSize: '13px', wordBreak: 'break-all' }}>{fileId}</div>
            </div>
            <div style={styles.detailItem}>
              <div style={styles.detailLabel}>Encryption</div>
              <div style={styles.detailValue}>Telegram MTProto</div>
            </div>
          </div>

          {/* Uploading banner */}
          {isUploading && (
            <div style={styles.uploadingBanner}>
              <Loader2 className="spinner" size={32} color="#3390ec" style={{ margin: '0 auto 12px', display: 'block' }} />
              <h4 style={{ color: '#3390ec', fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>Upload In Progress</h4>
              <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto' }}>
                The file owner is currently uploading this file to InfinityDrive servers. This page will automatically update when the upload is complete. You can bookmark this link and come back later.
              </p>
            </div>
          )}

          {/* Download progress */}
          {downloading && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${downloadProgress}%` }}></div>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'right' }}>
                Downloading... {Math.round(downloadProgress)}%
              </div>
            </div>
          )}

          {/* Error */}
          {downloadError && (
            <div style={styles.errorBox}>
              <strong>Download Failed:</strong> {downloadError}
            </div>
          )}

          {/* Actions */}
          <div style={styles.actions}>
            {!isUploading && (
              <button
                style={{
                  ...styles.downloadBtn,
                  opacity: downloading ? 0.7 : 1,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                }}
                onClick={handleDownload}
                disabled={downloading}
                onMouseEnter={e => { if (!downloading) e.currentTarget.style.backgroundColor = '#2b7fd4'; }}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3390ec'}
              >
                {downloading ? <Loader2 className="spinner" size={20} /> : <Download size={20} />}
                {downloading ? `Downloading... ${Math.round(downloadProgress)}%` : 'Download File'}
              </button>
            )}
            <button
              style={styles.secondaryBtn}
              onClick={handleCopyLink}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Share Link'}
            </button>
          </div>
        </div>

        {/* Security info */}
        <div style={{ ...styles.card, marginTop: '16px', padding: '24px 32px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <Shield size={24} color="#3390ec" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, color: '#1a202c', fontSize: '15px', marginBottom: '6px' }}>Secure & Encrypted</div>
            <div style={{ color: '#718096', fontSize: '13px', lineHeight: 1.6 }}>
              This file is stored securely using Telegram's MTProto encryption protocol. Files are transmitted over encrypted connections and stored in private channels. Only people with this link can access the file.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={{ fontWeight: 600, color: '#64748b' }}>InfinityDrive</span> — Truly unlimited cloud storage powered by Telegram.
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
