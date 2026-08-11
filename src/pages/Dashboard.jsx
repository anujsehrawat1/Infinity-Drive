import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { HardDrive, Settings, User, LogOut, File, Plus, UploadCloud, Search, Download, Link as LinkIcon, Trash2, X, PieChart, Check, Edit2, AlertTriangle, Clock, Infinity, TrendingUp, Files, Shield, Bell, Globe, Palette, ChevronRight, Copy, ExternalLink, AtSign, Phone, Hash, Calendar, Activity, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadFile, downloadFile } from '../storageEngine';
import { formatBytes } from '../utils/format';
import { db } from '../firebase';
import { ref, onValue, remove, set } from 'firebase/database';
import './Dashboard.css';

const DashboardOverview = ({ totalSize, files, openUploadDialog }) => {
  const doneFiles = files.filter(f => f.status === 'done');
  const activeFiles = files.filter(f => f.status === 'uploading' || f.status === 'queued');
  const recentFiles = [...doneFiles].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const { user } = useAuth();

  return (
    <div className="dashboard-content">
      {/* Hero Banner */}
      <div className="overview-hero">
        <div className="overview-hero-text">
          <h1>Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! 👋</h1>
          <p>Your personal cloud with truly unlimited storage — powered by Telegram.</p>
          <button className="btn-primary" style={{ marginTop: '16px', width: 'fit-content' }} onClick={openUploadDialog}>
            <UploadCloud size={18} /> Upload Files
          </button>
        </div>
        <div className="overview-hero-graphic">
          <Infinity size={120} strokeWidth={1} color="rgba(51,144,236,0.15)" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="overview-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(51,144,236,0.1)', color: '#3390ec' }}>
            <HardDrive size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{formatBytes(totalSize)}</div>
            <div className="stat-label">Total Stored</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(46,204,113,0.1)', color: '#2ecc71' }}>
            <Files size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{doneFiles.length}</div>
            <div className="stat-label">Files Uploaded</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(155,89,182,0.1)', color: '#9b59b6' }}>
            <Activity size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{activeFiles.length}</div>
            <div className="stat-label">Active Uploads</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(243,156,18,0.1)', color: '#f39c12' }}>
            <Infinity size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">∞</div>
            <div className="stat-label">Storage Limit</div>
          </div>
        </div>
      </div>

      {/* Storage Visualizer */}
      <div className="card">
        <div className="section-label">Storage Usage</div>
        <div className="storage-viz">
          <div className="storage-viz-bar">
            <div className="storage-viz-fill" style={{ width: '100%' }}></div>
          </div>
          <div className="storage-viz-row">
            <span className="storage-viz-used">{formatBytes(totalSize)} used</span>
            <span className="storage-viz-limit">∞ available</span>
          </div>
          <p className="storage-viz-note">InfinityDrive uses Telegram as your storage backend — you will never run out of space.</p>
        </div>
      </div>

      {/* Recent Files */}
      <div className="card">
        <div className="overview-section-header">
          <div className="section-label">Recent Files</div>
          <Link to="/dashboard/files" className="overview-view-all">View all <ChevronRight size={14} /></Link>
        </div>
        {recentFiles.length === 0 ? (
          <div className="overview-empty">
            <UploadCloud size={40} color="var(--tg-text-secondary)" style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p>No files yet. Upload your first file to get started.</p>
            <button className="btn-primary" style={{ marginTop: '12px' }} onClick={openUploadDialog}>
              <UploadCloud size={16} /> Upload Now
            </button>
          </div>
        ) : (
          <div className="overview-file-list">
            {recentFiles.map(f => (
              <div key={f.id} className="overview-file-row">
                <div className="file-icon" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                  <File size={20} color="#3390ec" />
                </div>
                <div className="file-info" style={{ minWidth: 0, flex: 1 }}>
                  <div className="file-name file-name-truncate" style={{ fontSize: '14px' }}>{f.name}</div>
                  <div className="file-meta">{formatBytes(f.size)} • {f.type || 'Unknown'}</div>
                </div>
                <div className="overview-file-date">
                  {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Helper: format ETA
const formatETA = (seconds) => {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return 'Calculating...';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m left`;
};

const DashboardFiles = ({ files, isFilesLoading, openUploadDialog, cancelUpload, hasActiveUploads }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [downloadingFiles, setDownloadingFiles] = useState({});
  
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState(null);

  const showAlert = (message, onConfirm = null) => {
    setAlertConfig({ message, onConfirm });
  };
  
  // Sort files: uploading/queued first, then done files
  const sortedFiles = [...files].sort((a, b) => {
    const aActive = a.status === 'uploading' || a.status === 'queued';
    const bActive = b.status === 'uploading' || b.status === 'queued';
    if (aActive && !bActive) return -1;
    if (bActive && !aActive) return 1;
    
    if (sortOrder === 'newest') return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortOrder === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
    if (sortOrder === 'largest') return (b.size || 0) - (a.size || 0);
    if (sortOrder === 'smallest') return (a.size || 0) - (b.size || 0);
    if (sortOrder === 'a-z') return a.name.localeCompare(b.name);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  
  const filteredFiles = sortedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleDownload = async (file) => {
    if (file.status === 'uploading' || file.status === 'queued') {
      showAlert("File is still uploading, please wait.");
      return;
    }
    if (downloadingFiles[file.id]) {
      showAlert("File is already downloading.");
      return;
    }

    setDownloadingFiles(prev => ({ ...prev, [file.id]: { progress: 0 } }));
    
    try {
      const buffer = await downloadFile(user.id, file, (progress) => {
        setDownloadingFiles(prev => ({ ...prev, [file.id]: { progress } }));
      });
      
      const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      showAlert("Download failed. Please try again.");
    } finally {
      setDownloadingFiles(prev => {
        const next = { ...prev };
        delete next[file.id];
        return next;
      });
    }
  };

  const handleCopyLink = (file) => {
    const link = `${window.location.origin}/d/${user.id}/${file.id}`;
    navigator.clipboard.writeText(link);
    showAlert("Download link successfully copied to your clipboard!");
  };

  const handleDelete = (file) => {
    if (file.status === 'uploading' || file.status === 'queued') {
      showAlert("Please cancel the upload instead of deleting.");
      return;
    }
    showAlert(`Are you sure you want to permanently delete ${file.name}?`, async () => {
      try {
        await remove(ref(db, `users/${user.id}/files/${file.id}`));
      } catch (e) {
        console.error(e);
      }
    });
  };

  const renderUploadingFile = (file) => {
    const isQueued = file.status === 'queued';
    const isPreparing = !isQueued && (!file.progress || file.progress === 0);

    return (
      <div key={file.id} className="file-item file-uploading-inline">
        <div className="file-icon"><File size={24} color="#3390ec" /></div>
        {/* file-info takes remaining space, min-width:0 allows text-overflow to work */}
        <div className="file-info" style={{ minWidth: 0, flex: 1 }}>
          <div className="file-name file-name-truncate">{file.name}</div>
          <div className="file-meta">
            <span className={`upload-status-label ${isQueued ? 'queued' : isPreparing ? 'preparing' : 'uploading'}`}>
              {isQueued ? 'Queued' : isPreparing ? 'Preparing...' : 'Uploading'}
            </span>
            {file.eta && !isQueued && !isPreparing && (
              <span className="eta-badge">
                <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                {formatETA(file.eta)}
              </span>
            )}
          </div>
        </div>
        {/* Fixed-width progress block — never shrinks no matter how long the filename */}
        <div className="inline-progress-container">
          <div className="inline-progress-header">
            <span className="inline-progress-pct">
              {isQueued ? '—' : isPreparing ? '...' : `${Math.round(file.progress)}%`}
            </span>
          </div>
          <div className="inline-progress-bar">
            <div className="inline-progress-fill" style={{ width: `${isQueued ? 0 : (file.progress || 0)}%` }}></div>
          </div>
        </div>
        <div className="file-actions">
          <button
            className="action-btn delete"
            onClick={() => showAlert(`Cancel upload of "${file.name}"?`, () => cancelUpload(file.id))}
            title="Cancel Upload"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-content">
      {/* Yellow warning banner */}
      {hasActiveUploads && (
        <div className="upload-warning-banner">
          <AlertTriangle size={18} />
          <span>Upload in progress — please do not close or refresh this page until all uploads are complete.</span>
        </div>
      )}

      <div className="file-manager card">
        <div className="fm-header">
          <h3>Your Files</h3>
          <div className="fm-actions">
            <div className="search-bar">
              <Search size={18} />
              <input type="text" placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="settings-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: '8px 12px', height: '36px' }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="largest">Largest first</option>
              <option value="smallest">Smallest first</option>
              <option value="a-z">A-Z</option>
            </select>
            <button className="btn-primary" onClick={openUploadDialog}><UploadCloud size={18} /> Upload</button>
          </div>
        </div>

        <div className="file-list">
          {isFilesLoading ? (
            <div style={{ padding: '20px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="file-item" style={{ opacity: 0.5, animation: 'pulse 1.5s infinite ease-in-out' }}>
                  <div className="file-icon" style={{ backgroundColor: '#e0e0e0' }}></div>
                  <div className="file-info">
                    <div style={{ height: '16px', width: '40%', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '8px' }}></div>
                    <div style={{ height: '12px', width: '20%', backgroundColor: '#e0e0e0', borderRadius: '4px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{padding: '40px', textAlign: 'center', color: 'var(--tg-text-secondary)'}}>No files found.</div>
          ) : (
            filteredFiles.map(file => {
              if (file.status === 'uploading' || file.status === 'queued') {
                return renderUploadingFile(file);
              }

              // Stuck files (from previous interrupted session)
              if (file.status === 'stuck' || file.status === 'error') {
                return (
                  <div key={file.id} className="file-item" style={{ backgroundColor: 'rgba(239, 68, 68, 0.04)' }}>
                    <div className="file-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}><File size={24} color="#ef4444" /></div>
                    <div className="file-info" style={{ minWidth: 0 }}>
                      <div className="file-name file-name-truncate">{file.name}</div>
                      <div className="file-meta" style={{ color: '#ef4444' }}>
                        {file.status === 'stuck' ? 'Upload interrupted — refresh to retry or remove' : 'Upload failed'}
                      </div>
                    </div>
                    <div className="file-actions">
                      <button className="action-btn delete" onClick={() => showAlert(`Remove interrupted file "${file.name}"?`, () => cancelUpload(file.id))} title="Remove"><Trash2 size={18} /></button>
                    </div>
                  </div>
                );
              }

              const isDownloading = downloadingFiles[file.id];
              return (
                <div key={file.id} className="file-item">
                  <div className="file-icon"><File size={24} color="#3390ec" /></div>
                  <div className="file-info" style={{ minWidth: 0, flex: 1 }}>
                    <div className="file-name file-name-truncate">
                      {file.name}
                      {file.isChunked && <span style={{fontSize: '10px', background: '#eee', padding: '2px 6px', borderRadius: '10px', marginLeft: '8px', flexShrink: 0}}>Chunked &gt;4GB</span>}
                    </div>
                    <div className="file-meta">{file.type || 'Unknown'} • {formatBytes(file.size)}</div>
                  </div>
                  {isDownloading && (
                    <div className="inline-progress-container" style={{ marginRight: '16px' }}>
                      <div className="inline-progress-header">
                        <span className="inline-progress-pct">{Math.round(isDownloading.progress || 0)}%</span>
                      </div>
                      <div className="inline-progress-bar">
                        <div className="inline-progress-fill" style={{ width: `${isDownloading.progress || 0}%` }}></div>
                      </div>
                    </div>
                  )}
                  <div className="file-actions">
                    <button className="action-btn download" onClick={() => handleDownload(file)} title="Download" disabled={!!isDownloading} style={{ opacity: isDownloading ? 0.5 : 1 }}>
                      <Download size={18} />
                    </button>
                    <button className="action-btn link" onClick={() => handleCopyLink(file)} title="Copy Link"><LinkIcon size={18} /></button>
                    <button className="action-btn delete" onClick={() => handleDelete(file)} title="Delete"><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Custom Alert Dialog */}
      {alertConfig && (
        <div className="dialog-overlay" onClick={() => setAlertConfig(null)}>
          <div className="dialog-box" style={{ maxWidth: '400px', padding: '24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px', fontSize: '20px' }}>Notice</h3>
            <p style={{ color: 'var(--tg-text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>{alertConfig.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setAlertConfig(null)}>
                {alertConfig.onConfirm ? 'Cancel' : 'Okay'}
              </button>
              {alertConfig.onConfirm && (
                <button className="btn-primary" onClick={() => {
                  alertConfig.onConfirm();
                  setAlertConfig(null);
                }}>
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CopyableField = ({ label, value, icon }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="profile-field">
      <div className="profile-field-label">
        {icon && <span className="profile-field-icon">{icon}</span>}
        {label}
      </div>
      <div className="profile-field-value-row">
        <span className="profile-field-value">{value || '—'}</span>
        {value && (
          <button className="icon-btn" onClick={copy} title="Copy">
            {copied ? <CheckCircle size={14} color="#2ecc71" /> : <Copy size={14} color="var(--tg-text-secondary)" />}
          </button>
        )}
      </div>
    </div>
  );
};

const Profile = ({ files }) => {
  const { user } = useAuth();
  const doneFiles = (files || []).filter(f => f.status === 'done');
  const totalSize = doneFiles.reduce((a, f) => a + (f.size || 0), 0);
  const joinedDate = user?.id ? new Date(parseInt(user.id.toString().substring(0, 8), 16) * 1000) : null;

  return (
    <div className="dashboard-content">
      {/* Profile Hero */}
      <div className="profile-hero card">
        <div className="profile-avatar">
          {user?.firstName?.[0] || user?.username?.[0] || 'U'}
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-name">
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Unknown User'}
          </h2>
          {user?.username && (
            <a
              href={`https://t.me/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-username-link"
            >
              @{user.username} <ExternalLink size={13} />
            </a>
          )}
          <div className="profile-badges">
            <span className="profile-badge blue"><Shield size={12} /> Telegram Verified</span>
            <span className="profile-badge green"><CheckCircle size={12} /> Active Session</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="overview-stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(51,144,236,0.1)', color: '#3390ec' }}><Files size={20} /></div>
          <div className="stat-info"><div className="stat-value">{doneFiles.length}</div><div className="stat-label">Files Stored</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(155,89,182,0.1)', color: '#9b59b6' }}><HardDrive size={20} /></div>
          <div className="stat-info"><div className="stat-value">{formatBytes(totalSize)}</div><div className="stat-label">Data Stored</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(46,204,113,0.1)', color: '#2ecc71' }}><Infinity size={20} /></div>
          <div className="stat-info"><div className="stat-value">∞</div><div className="stat-label">Storage Cap</div></div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: '16px' }}>Telegram Account Info</div>
        <div className="profile-fields">
          <CopyableField label="First Name" value={user?.firstName} icon={<User size={13} />} />
          <CopyableField label="Last Name" value={user?.lastName} icon={<User size={13} />} />
          <CopyableField label="Username" value={user?.username ? `@${user.username}` : null} icon={<AtSign size={13} />} />
          <CopyableField label="Phone Number" value={user?.phone ? `+${user.phone}` : null} icon={<Phone size={13} />} />
          <CopyableField label="Telegram ID" value={user?.id?.toString()} icon={<Hash size={13} />} />
        </div>
      </div>

      {/* Session Info */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: '16px' }}>Session Info</div>
        <div className="profile-fields">
          <div className="profile-field">
            <div className="profile-field-label"><span className="profile-field-icon"><Activity size={13} /></span>Session Status</div>
            <div className="profile-field-value-row">
              <span className="profile-badge green" style={{ margin: 0 }}><CheckCircle size={12} /> Connected</span>
            </div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label"><span className="profile-field-icon"><Globe size={13} /></span>Backend</div>
            <div className="profile-field-value-row"><span className="profile-field-value">Telegram MTProto</span></div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label"><span className="profile-field-icon"><Shield size={13} /></span>Encryption</div>
            <div className="profile-field-value-row"><span className="profile-field-value">End-to-end (MTProto 2.0)</span></div>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="info-notice">
        <Info size={16} />
        <span>Your account details are read from Telegram and cannot be edited here. To update your profile, open the Telegram app.</span>
      </div>
    </div>
  );
};

const SettingToggle = ({ label, description, value, onChange }) => (
  <div className="settings-row">
    <div className="settings-row-info">
      <div className="settings-row-label">{label}</div>
      <div className="settings-row-desc">{description}</div>
    </div>
    <button
      className={`settings-toggle ${value ? 'on' : 'off'}`}
      onClick={() => onChange(!value)}
      aria-label={label}
    >
      <span className="settings-toggle-thumb"></span>
    </button>
  </div>
);

const SettingSelect = ({ label, description, options, value, onChange }) => (
  <div className="settings-row">
    <div className="settings-row-info">
      <div className="settings-row-label">{label}</div>
      <div className="settings-row-desc">{description}</div>
    </div>
    <select
      className="settings-select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const SettingsPage = () => {
  // Persist settings in localStorage
  const load = (key, def) => { try { const v = localStorage.getItem(`inf_${key}`); return v === null ? def : JSON.parse(v); } catch { return def; } };
  const save = (key, val) => localStorage.setItem(`inf_${key}`, JSON.stringify(val));

  const [showExt, setShowExt] = useState(() => load('showExt', true));
  const [confirmDelete, setConfirmDelete] = useState(() => load('confirmDelete', true));
  const [copyNotif, setCopyNotif] = useState(() => load('copyNotif', true));
  const [openNewTab, setOpenNewTab] = useState(() => load('openNewTab', true));
  const [dateFormat, setDateFormat] = useState(() => load('dateFormat', 'relative'));
  const [sizeUnit, setSizeUnit] = useState(() => load('sizeUnit', 'auto'));
  const [uploadConcurrency, setUploadConcurrency] = useState(() => load('uploadConcurrency', 'sequential'));

  const toggle = (setter, key) => (val) => { setter(val); save(key, val); };
  const select = (setter, key) => (val) => { setter(val); save(key, val); };

  return (
    <div className="dashboard-content">
      {/* General */}
      <div className="card">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(51,144,236,0.1)', color: '#3390ec' }}>
            <Settings size={18} />
          </div>
          <div>
            <div className="section-label">General</div>
            <div className="settings-section-desc">Basic app behaviour and display preferences</div>
          </div>
        </div>
        <div className="settings-rows">
          <SettingToggle
            label="Show File Extensions"
            description="Display file extension as part of the file name in the list"
            value={showExt}
            onChange={toggle(setShowExt, 'showExt')}
          />
          <SettingSelect
            label="Date Format"
            description="How dates are shown across the app"
            value={dateFormat}
            onChange={select(setDateFormat, 'dateFormat')}
            options={[
              { value: 'relative', label: 'Relative (2 hours ago)' },
              { value: 'short', label: 'Short (10 Aug 2026)' },
              { value: 'iso', label: 'ISO (2026-08-10)' },
            ]}
          />
          <SettingSelect
            label="Size Unit"
            description="Unit to use when displaying file sizes"
            value={sizeUnit}
            onChange={select(setSizeUnit, 'sizeUnit')}
            options={[
              { value: 'auto', label: 'Auto (KB / MB / GB)' },
              { value: 'mb', label: 'Always MB' },
              { value: 'bytes', label: 'Always Bytes' },
            ]}
          />
        </div>
      </div>

      {/* Uploads */}
      <div className="card">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(155,89,182,0.1)', color: '#9b59b6' }}>
            <UploadCloud size={18} />
          </div>
          <div>
            <div className="section-label">Uploads</div>
            <div className="settings-section-desc">Control how files are uploaded to your drive</div>
          </div>
        </div>
        <div className="settings-rows">
          <SettingSelect
            label="Upload Mode"
            description="Sequential uploads are safer; parallel is faster but may stress the Telegram connection"
            value={uploadConcurrency}
            onChange={select(setUploadConcurrency, 'uploadConcurrency')}
            options={[
              { value: 'sequential', label: 'Sequential (one at a time)' },
              { value: 'parallel', label: 'Parallel (experimental)' },
            ]}
          />
        </div>
      </div>

      {/* Files & Links */}
      <div className="card">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(46,204,113,0.1)', color: '#2ecc71' }}>
            <LinkIcon size={18} />
          </div>
          <div>
            <div className="section-label">Files &amp; Links</div>
            <div className="settings-section-desc">Configure how files are opened and shared</div>
          </div>
        </div>
        <div className="settings-rows">
          <SettingToggle
            label="Open Downloads in New Tab"
            description="When you click a download link, open it in a new browser tab"
            value={openNewTab}
            onChange={toggle(setOpenNewTab, 'openNewTab')}
          />
          <SettingToggle
            label="Confirm Before Deleting"
            description="Show a confirmation dialog before permanently deleting a file"
            value={confirmDelete}
            onChange={toggle(setConfirmDelete, 'confirmDelete')}
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(243,156,18,0.1)', color: '#f39c12' }}>
            <Bell size={18} />
          </div>
          <div>
            <div className="section-label">Notifications</div>
            <div className="settings-section-desc">In-app notification preferences</div>
          </div>
        </div>
        <div className="settings-rows">
          <SettingToggle
            label="Copy Link Notification"
            description="Show a toast when a share link is copied to clipboard"
            value={copyNotif}
            onChange={toggle(setCopyNotif, 'copyNotif')}
          />
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(52,152,219,0.1)', color: '#3498db' }}>
            <Info size={18} />
          </div>
          <div>
            <div className="section-label">About InfinityDrive</div>
            <div className="settings-section-desc">App version and technical details</div>
          </div>
        </div>
        <div className="settings-rows">
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Version</div>
              <div className="settings-row-desc">Current release</div>
            </div>
            <span className="settings-row-value">1.0.0-beta</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Storage Backend</div>
              <div className="settings-row-desc">Protocol used to store your files</div>
            </div>
            <span className="settings-row-value">Telegram MTProto</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-info">
              <div className="settings-row-label">Database</div>
              <div className="settings-row-desc">Where file metadata is stored</div>
            </div>
            <span className="settings-row-value">Firebase Realtime DB</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  
  const [files, setFiles] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState([]);
  // Incrementing key forces hidden file inputs to remount → resets their value
  // so the same file can be re-selected after being cleared
  const [inputKey, setInputKey] = useState(0);
  
  const hiddenFileInput = useRef(null);
  const hiddenFolderInput = useRef(null);
  const cancelledUploads = useRef(new Set());
  const [uploadProgress, setUploadProgress] = useState({}); // { uploadId: { progress, eta } }

  // Store latest Firebase data in a ref so we can merge progress on every render
  const firebaseFiles = useRef({});

  // Merge Firebase data + local progress into files state
  const deriveFiles = useCallback((data, progressMap) => {
    if (!data || Object.keys(data).length === 0) {
      setFiles([]);
      setTotalSize(0);
      return;
    }
    const fileList = Object.keys(data).map(key => ({ 
      id: key, 
      ...data[key],
      progress: progressMap[key]?.progress ?? 0,
      eta: progressMap[key]?.eta ?? null,
    }));
    setFiles(fileList);
    // Ignore stuck and error files in total size calculation
    const total = fileList.reduce((acc, curr) => {
      if (curr.status === 'stuck' || curr.status === 'error') return acc;
      return acc + (curr.size || 0);
    }, 0);
    setTotalSize(total);
  }, []);

  useEffect(() => {
    if (!user) return;
    const filesRef = ref(db, `users/${user.id}/files`);
    const unsubscribe = onValue(filesRef, (snapshot) => {
      const data = snapshot.val() || {};
      firebaseFiles.current = data;
      deriveFiles(data, uploadProgress);
      setIsFilesLoading(false);
    });
    return () => unsubscribe();
  }, [user, deriveFiles]);

  // Whenever uploadProgress state changes, re-derive files with latest progress
  useEffect(() => {
    deriveFiles(firebaseFiles.current, uploadProgress);
  }, [uploadProgress, deriveFiles]);

  // On mount: clean up any stuck "uploading" files (from previous refresh)
  useEffect(() => {
    if (!user) return;
    const data = firebaseFiles.current;
    if (!data) return;
    // Delay slightly so Firebase data loads first
    const timeout = setTimeout(() => {
      const currentData = firebaseFiles.current;
      if (!currentData) return;
      Object.keys(currentData).forEach(key => {
        const file = currentData[key];
        if (file.status === 'uploading' || file.status === 'queued') {
          // Mark as stuck - no active upload for this after refresh
          if (!uploadProgress[key]) {
            set(ref(db, `users/${user.id}/files/${key}/status`), 'stuck');
          }
        }
      });
    }, 3000);
    return () => clearTimeout(timeout);
  }, [user, isFilesLoading]);

  // Recursively read dropped folders
  const getFilesFromDataTransfer = async (dataTransfer) => {
    const fileList = [];
    const readEntry = async (entry) => {
      if (entry.isFile) {
        return new Promise(resolve => entry.file(f => { fileList.push(f); resolve(); }));
      } else if (entry.isDirectory) {
        return new Promise(resolve => {
          const dirReader = entry.createReader();
          dirReader.readEntries(async entries => {
            await Promise.all(entries.map(e => readEntry(e)));
            resolve();
          });
        });
      }
    };
    
    const promises = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) promises.push(readEntry(entry));
      }
    }
    await Promise.all(promises);
    return fileList;
  };

  const handleDialogDrop = async (e) => {
    e.preventDefault();
    const dropped = await getFilesFromDataTransfer(e.dataTransfer);
    addStagedFiles(dropped);
  };

  const handleDialogFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    addStagedFiles(selected);
    // Bump key → forces re-mount of inputs → resets their value
    // so the same file can be picked again in the same session
    setInputKey(k => k + 1);
  };

  const addStagedFiles = (newFiles) => {
    const mapped = newFiles.map(f => ({
      rawFile: f,
      id: Date.now().toString() + "_" + Math.floor(Math.random() * 100000),
      customName: f.name,
      isEditing: false
    }));
    setStagedFiles(prev => [...prev, ...mapped]);
  };

  const toggleEditStagedName = (id, editing) => {
    setStagedFiles(prev => prev.map(sf => sf.id === id ? { ...sf, isEditing: editing } : sf));
  };

  const updateStagedName = (id, newName) => {
    setStagedFiles(prev => prev.map(sf => sf.id === id ? { ...sf, customName: newName } : sf));
  };

  const removeStagedFile = (id) => {
    setStagedFiles(prev => prev.filter(sf => sf.id !== id));
  };

  const openUploadDialog = useCallback(() => {
    // Always clear staged files AND reset inputs when opening dialog fresh
    // This prevents previously-selected files from appearing pre-added
    setStagedFiles([]);
    setInputKey(k => k + 1);
    setIsDialogOpen(true);
  }, []);

  const commitUploads = async () => {
    const filesToUpload = [...stagedFiles];
    setIsDialogOpen(false);
    setStagedFiles([]);
    setInputKey(k => k + 1);

    if (!location.pathname.includes('/files')) {
      navigate('/dashboard/files');
    }

    // Step 1: Create ALL files in Firebase immediately as 'queued'
    for (const staged of filesToUpload) {
      await set(ref(db, `users/${user.id}/files/${staged.id}`), {
        name: staged.customName,
        originalName: staged.rawFile.name,
        size: staged.rawFile.size,
        type: staged.rawFile.type,
        isChunked: false,
        status: 'queued',
        createdAt: Date.now(),
      });
      setUploadProgress(prev => ({ ...prev, [staged.id]: { progress: 0, eta: null } }));
    }

    // Step 2: Upload files one by one
    for (const staged of filesToUpload) {
      const uploadId = staged.id;

      // Check if cancelled while queued
      if (cancelledUploads.current.has(uploadId)) {
        await remove(ref(db, `users/${user.id}/files/${uploadId}`));
        cancelledUploads.current.delete(uploadId);
        continue;
      }

      const checkCancelled = () => cancelledUploads.current.has(uploadId);

      try {
        let lastProgressUpdate = 0;
        let lastProgressValue = 0;
        let uploadStartTime = Date.now();
        
        await uploadFile(user.id, staged.rawFile, staged.customName, uploadId, (progress) => {
          const now = Date.now();
          // Throttle: only update state every 150ms or on big jumps (>2%) or at completion
          if (now - lastProgressUpdate > 150 || progress - lastProgressValue > 2 || progress >= 100) {
            lastProgressUpdate = now;
            lastProgressValue = progress;
            
            // Calculate ETA
            const elapsed = (now - uploadStartTime) / 1000; // seconds
            let eta = null;
            if (progress > 5) {
              const adjustedProgress = progress - 5; // remove the initial 5% bump
              const rate = adjustedProgress / elapsed; // % per second
              const remaining = 100 - progress;
              eta = rate > 0 ? remaining / rate : null;
            }
            
            setUploadProgress(prev => ({ ...prev, [uploadId]: { progress, eta } }));
          }
        }, checkCancelled);
        
        // Clean up progress entry after upload completes
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
      } catch (err) {
        console.error("Upload error details:", err);
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
      }
    }
  };

  const cancelUpload = async (uploadId) => {
    cancelledUploads.current.add(uploadId);
    // Force remove from Firebase (handles stuck/preparing/queued state)
    try {
      await remove(ref(db, `users/${user.id}/files/${uploadId}`));
    } catch (e) {
      console.error('Force cancel error:', e);
    }
    // Clean up progress
    setUploadProgress(prev => {
      const next = { ...prev };
      delete next[uploadId];
      return next;
    });
  };

  // Check if any uploads are active
  const hasActiveUploads = files.some(f => f.status === 'uploading' || f.status === 'queued');

  // Warn before page close
  useEffect(() => {
    if (!hasActiveUploads) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = 'Upload in progress. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasActiveUploads]);

  if (loading) return <div style={{padding: '50px', textAlign: 'center'}}>Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <HardDrive color="var(--tg-blue)" /> InfinityDrive
        </div>
        <nav className="sidebar-nav">
          <Link to="/dashboard/overview" className={`nav-item ${location.pathname.includes('/overview') || location.pathname === '/dashboard' ? 'active' : ''}`}>
            <PieChart size={20} /> Overview
          </Link>
          <Link to="/dashboard/files" className={`nav-item ${location.pathname.includes('/files') ? 'active' : ''}`}>
            <HardDrive size={20} /> My Files
          </Link>
          <Link to="/dashboard/profile" className={`nav-item ${location.pathname.includes('/profile') ? 'active' : ''}`}>
            <User size={20} /> Profile
          </Link>
          <Link to="/dashboard/settings" className={`nav-item ${location.pathname.includes('/settings') ? 'active' : ''}`}>
            <Settings size={20} /> Settings
          </Link>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={() => { logout(); navigate('/'); }}>
            <LogOut size={20} /> Logout
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<DashboardOverview totalSize={totalSize} files={files} openUploadDialog={openUploadDialog} />} />
          <Route path="files" element={<DashboardFiles files={files} isFilesLoading={isFilesLoading} openUploadDialog={openUploadDialog} cancelUpload={cancelUpload} hasActiveUploads={hasActiveUploads} />} />
          <Route path="profile" element={<Profile files={files} />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* Custom Upload Dialog */}
      {isDialogOpen && (
        <div className="dialog-overlay" onClick={() => setIsDialogOpen(false)}>
          <div className="dialog-box" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Upload Files</h3>
              <button className="dialog-close" onClick={() => setIsDialogOpen(false)}><X size={20} /></button>
            </div>
            
            <div className="dialog-body">
              <div className="drop-zone" onDragOver={e => e.preventDefault()} onDrop={handleDialogDrop} onClick={(e) => {
                if (e.target.tagName !== 'SPAN') hiddenFileInput.current.click();
              }}>
                <UploadCloud size={48} color="var(--tg-blue)" style={{marginBottom: '12px'}} />
                <h4 style={{ fontWeight: 500 }}>
                  Click to select a <span style={{ color: 'var(--tg-blue)', cursor: 'pointer', textDecoration: 'underline' }} onClick={(e) => { e.stopPropagation(); hiddenFileInput.current.click(); }}>file</span> or a <span style={{ color: 'var(--tg-blue)', cursor: 'pointer', textDecoration: 'underline', position: 'relative', zIndex: 10 }} onClick={(e) => { e.stopPropagation(); hiddenFolderInput.current.click(); }}>folder</span>
                </h4>
                <p style={{color: 'var(--tg-text-secondary)', fontSize: '14px', marginTop: '8px'}}>Or drag and drop them anywhere in this box.</p>
                {/* key prop forces remount on inputKey change → clears value so same file can re-trigger onChange */}
                <input key={`file-${inputKey}`} type="file" multiple ref={hiddenFileInput} style={{display: 'none'}} onChange={handleDialogFileSelect} />
                <input key={`folder-${inputKey}`} type="file" multiple webkitdirectory="" directory="" ref={hiddenFolderInput} style={{display: 'none'}} onChange={handleDialogFileSelect} />
              </div>

              {stagedFiles.length > 0 && (
                <div className="staged-list">
                  {stagedFiles.map(sf => (
                    <div key={sf.id} className="staged-item">
                      <div className="staged-icon"><File size={20} /></div>
                      <div className="staged-info">
                        {sf.isEditing ? (
                          <input 
                            type="text" 
                            className="staged-name-input" 
                            value={sf.customName} 
                            onChange={e => updateStagedName(sf.id, e.target.value)} 
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') toggleEditStagedName(sf.id, false) }}
                          />
                        ) : (
                          <div className="staged-name-input" style={{ fontWeight: 600, border: '1px solid transparent' }}>{sf.customName}</div>
                        )}
                        <div className="staged-meta">{sf.rawFile.type || 'Unknown'} • {formatBytes(sf.rawFile.size)}</div>
                      </div>
                      <div className="staged-actions">
                        {sf.isEditing ? (
                          <button className="icon-btn" title="Save" onClick={() => toggleEditStagedName(sf.id, false)}><Check size={16} color="#2ecc71" /></button>
                        ) : (
                          <button className="icon-btn" title="Edit" onClick={() => toggleEditStagedName(sf.id, true)}><Edit2 size={16} color="var(--tg-text-secondary)" /></button>
                        )}
                        <button className="icon-btn" title="Remove" onClick={() => removeStagedFile(sf.id)}><X size={16} color="#e53935" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="dialog-footer">
              <button className="btn-secondary" onClick={() => setIsDialogOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={stagedFiles.length === 0} onClick={commitUploads}>Start Upload ({stagedFiles.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
