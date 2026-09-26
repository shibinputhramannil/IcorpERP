import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Avatar,
  Button,
  IconButton,
  Tabs,
  Tab,
  Stack,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { extractErrorMessage } from '../../utils/errorUtils';

const AVATAR_PRESETS = [
  { id: 'p1', label: 'Executive 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80' },
  { id: 'p2', label: 'Executive 2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80' },
  { id: 'p3', label: 'Professional 1', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160&auto=format&fit=crop&q=80' },
  { id: 'p4', label: 'Professional 2', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80' },
  { id: 'p5', label: 'Tech Lead 1', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80' },
  { id: 'p6', label: 'Tech Lead 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80' },
  { id: 'p7', label: 'Corporate 1', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80' },
  { id: 'p8', label: 'Modern 1', url: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=160&auto=format&fit=crop&q=80' },
];

export default function AvatarDialog({ open, onClose, user }) {
  const { refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(0); // 0: Upload, 1: Presets
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentAvatar = user?.avatar || (user?.id ? localStorage.getItem(`user_avatar_${user.id}`) : null);
  const initial = (user?.username || 'U').charAt(0).toUpperCase();

  // Preview source priorities: file preview > selected preset > current avatar
  const displayPreview = filePreview || selectedPreset || currentAvatar;

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setErrorMsg('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP, etc.).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size cannot exceed 5MB.');
      return;
    }

    setSelectedFile(file);
    setSelectedPreset(null);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setFilePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (presetUrl) => {
    setSelectedPreset(presetUrl);
    setSelectedFile(null);
    setFilePreview(null);
    setErrorMsg('');
  };

  const handleSave = async () => {
    if (!selectedFile && !selectedPreset) {
      setErrorMsg('Please select an image file or a preset avatar first.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        res = await api.post('/auth/profile/avatar/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (selectedPreset) {
        res = await api.post('/auth/profile/avatar/', {
          avatar_url: selectedPreset,
        });
      }

      if (user?.id && res?.data?.avatar_url) {
        localStorage.setItem(`user_avatar_${user.id}`, res.data.avatar_url);
      }

      setSuccessMsg('Profile picture updated successfully!');
      await refreshUser();

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Failed to update profile picture.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.delete('/auth/profile/avatar/');
      if (user?.id) {
        localStorage.removeItem(`user_avatar_${user.id}`);
      }
      setSelectedFile(null);
      setFilePreview(null);
      setSelectedPreset(null);
      setSuccessMsg('Profile picture removed successfully.');
      await refreshUser();

      setTimeout(() => {
        handleClose();
      }, 800);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Failed to remove profile picture.'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setSelectedPreset(null);
    setErrorMsg('');
    setSuccessMsg('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'text.primary' }}>
          Change Profile Picture
        </Typography>
        <IconButton size="small" onClick={handleClose} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        {/* Preview Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            mb: 2,
            borderRadius: 2,
            backgroundColor: 'background.subtle',
            border: '1px dashed #cbd5e1',
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={displayPreview}
              alt={user?.username}
              sx={{
                width: 96,
                height: 96,
                fontSize: '2.5rem',
                fontWeight: 700,
                bgcolor: 'primary.main',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                border: '3px solid #ffffff',
              }}
            >
              {initial}
            </Avatar>
            {(filePreview || selectedPreset) && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'background.paper',
                  borderRadius: '50%',
                  display: 'flex',
                  p: 0.2,
                }}
              >
                <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 24 }} />
              </Box>
            )}
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1.5, color: 'text.primary' }}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {filePreview || selectedPreset
              ? 'Previewing new selection'
              : currentAvatar
              ? 'Current profile photo'
              : 'Using default initials'}
          </Typography>
        </Box>

        {/* Alerts */}
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }} onClose={() => setErrorMsg('')}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mb: 2, fontSize: '0.85rem' }}>
            {successMsg}
          </Alert>
        )}

        {/* Tabs for Upload vs Preset */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            mb: 2,
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 38,
              py: 0.5,
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          <Tab icon={<PhotoCameraOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Upload Photo" />
          <Tab icon={<CollectionsOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Avatar Presets" />
        </Tabs>

        {/* Tab 0: File Upload */}
        {activeTab === 0 && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              fullWidth
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                py: 1.5,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                borderColor: '#93c5fd',
                color: '#1d4ed8',
                backgroundColor: '#eff6ff',
                '&:hover': {
                  backgroundColor: '#dbeafe',
                  borderColor: '#3b82f6',
                  borderStyle: 'dashed',
                  borderWidth: 2,
                },
              }}
            >
              Choose Image from Computer
            </Button>
            {selectedFile && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontWeight: 500 }}>
                Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#94a3b8' }}>
              Supports PNG, JPG, JPEG, WEBP or GIF (Max 5MB)
            </Typography>
          </Box>
        )}

        {/* Tab 1: Presets */}
        {activeTab === 1 && (
          <Box sx={{ py: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Select a professional avatar from our curated presets:
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1.5,
                maxHeight: 180,
                overflowY: 'auto',
                p: 0.5,
              }}
            >
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.url;
                return (
                  <Tooltip key={preset.id} title={preset.label}>
                    <Box
                      onClick={() => handleSelectPreset(preset.url)}
                      sx={{
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 0.5,
                        borderRadius: 2,
                        transition: 'all 0.15s ease',
                        border: isSelected ? '2px solid #2563eb' : '2px solid transparent',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <Avatar
                        src={preset.url}
                        alt={preset.label}
                        sx={{
                          width: 48,
                          height: 48,
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        }}
                      />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 0, justifyContent: 'space-between' }}>
        {currentAvatar ? (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
            onClick={handleRemoveAvatar}
            disabled={saving}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            Remove
          </Button>
        ) : (
          <Box />
        )}

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            onClick={handleClose}
            disabled={saving}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={saving || (!selectedFile && !selectedPreset)}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              px: 2,
            }}
          >
            {saving ? 'Saving...' : 'Save Picture'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
