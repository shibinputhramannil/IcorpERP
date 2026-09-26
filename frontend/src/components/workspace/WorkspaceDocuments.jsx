import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

import workspaceService from '../../services/workspaceService';
import { useAuth } from '../../hooks/useAuth';

export default function WorkspaceDocuments({ companyId, externalOpenUpload, onUploadOpened, isAdmin }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Upload Dialog State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [customName, setCustomName] = useState('');
  const [relatedModule, setRelatedModule] = useState('workspace');
  const [uploadError, setUploadError] = useState(null);

  const loadDocuments = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getDocuments(companyId, {
        search: search || undefined,
        file_type: fileTypeFilter || undefined,
        related_module: moduleFilter || undefined,
        page: currentPage,
        page_size: 15,
      });
      setDocuments(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load company documents.');
    } finally {
      setLoading(false);
    }
  }, [companyId, search, fileTypeFilter, moduleFilter, currentPage]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (externalOpenUpload) {
      setUploadOpen(true);
      if (onUploadOpened) onUploadOpened();
    }
  }, [externalOpenUpload, onUploadOpened]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!customName) {
        setCustomName(file.name);
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (customName.trim()) {
        formData.append('name', customName.trim());
      }
      formData.append('related_module', relatedModule);

      await workspaceService.uploadDocument(companyId, formData);
      setSuccessMsg(`Document "${customName || selectedFile.name}" uploaded successfully.`);
      setUploadOpen(false);
      setSelectedFile(null);
      setCustomName('');
      setRelatedModule('workspace');
      loadDocuments();
    } catch (err) {
      const errMsg = err.response?.data?.file?.[0] || err.response?.data?.detail || 'Failed to upload document.';
      setUploadError(errMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.name}"?`)) return;
    try {
      await workspaceService.deleteDocument(companyId, doc.id);
      setSuccessMsg('Document deleted successfully.');
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete document.');
    }
  };

  const getFileIcon = (fileType) => {
    const ft = (fileType || '').toUpperCase();
    if (ft === 'PDF') return <PictureAsPdfOutlinedIcon sx={{ color: '#ef4444' }} />;
    if (['XLS', 'XLSX', 'CSV'].includes(ft)) return <TableChartOutlinedIcon sx={{ color: '#10b981' }} />;
    if (['PNG', 'JPG', 'JPEG', 'WEBP', 'SVG'].includes(ft)) return <ImageOutlinedIcon sx={{ color: '#06b6d4' }} />;
    return <InsertDriveFileOutlinedIcon sx={{ color: '#64748b' }} />;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Workspace Documents ({totalCount})
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Central repository for contracts, sheets, specs, policies, and files.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadDocuments}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            startIcon={<CloudUploadOutlinedIcon />}
            onClick={() => {
              setUploadError(null);
              setUploadOpen(true);
            }}
          >
            Upload Document
          </Button>
        </Stack>
      </Box>

      {/* Feedback Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Search & Filter Toolbar */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', mb: 3 }}>
        <Box sx={{ p: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            sx={{ width: { xs: '100%', sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ width: 140 }}>
            <InputLabel>File Type</InputLabel>
            <Select
              value={fileTypeFilter}
              label="File Type"
              onChange={(e) => {
                setFileTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="PDF">PDF</MenuItem>
              <MenuItem value="DOCX">DOCX</MenuItem>
              <MenuItem value="XLSX">XLSX</MenuItem>
              <MenuItem value="TXT">TXT</MenuItem>
              <MenuItem value="CSV">CSV</MenuItem>
              <MenuItem value="PNG">PNG/JPG</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: 150 }}>
            <InputLabel>Module</InputLabel>
            <Select
              value={moduleFilter}
              label="Module"
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <MenuItem value="">All Modules</MenuItem>
              <MenuItem value="workspace">Workspace</MenuItem>
              <MenuItem value="crm">CRM</MenuItem>
              <MenuItem value="sales">Sales</MenuItem>
              <MenuItem value="purchase">Purchase</MenuItem>
              <MenuItem value="finance">Finance</MenuItem>
              <MenuItem value="hr">HR</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Documents Table */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <TableContainer component={Paper} elevation={0}>
          <Table size="medium">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>DOCUMENT</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>SIZE</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>MODULE</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>UPLOADED BY</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>DATE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.secondary' }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No documents found matching the filter criteria.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const canDelete = isAdmin || user?.is_superuser || doc.uploaded_by === user?.id;
                  return (
                    <TableRow key={doc.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {getFileIcon(doc.file_type)}
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {doc.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.file_type || 'FILE'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600, bgcolor: '#f1f5f9' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {doc.file_size_formatted || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.related_module || 'workspace'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.675rem', fontWeight: 600, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {doc.uploaded_by_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {formatTime(doc.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                          <Tooltip title="Download Document">
                            <IconButton
                              size="small"
                              color="primary"
                              href={doc.download_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileDownloadOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {canDelete && (
                            <Tooltip title="Delete Document">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(doc)}
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(e, page) => setCurrentPage(page)}
            color="primary"
          />
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleUploadSubmit}>
          <DialogTitle sx={{ fontWeight: 700 }}>Upload Workspace Document</DialogTitle>
          <DialogContent>
            {uploadError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {uploadError}
              </Alert>
            )}

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Upload contracts, proposals, spreadsheets, or reference files up to 25MB. Executable files (.exe, .bat, .sh) are prohibited.
            </Typography>

            {/* Hidden native input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 3,
                border: '2px dashed #cbd5e1',
                borderRadius: 2,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: '#f8fafc',
                mb: 2,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main', bgcolor: '#eff6ff' },
              }}
            >
              <CloudUploadOutlinedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedFile ? selectedFile.name : 'Click to select a file from your computer'}
              </Typography>
              {selectedFile && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  Size: {(selectedFile.size / 1024).toFixed(1)} KB
                </Typography>
              )}
            </Box>

            <TextField
              label="Document Name"
              fullWidth
              size="small"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Master Services Agreement 2026"
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Related Module</InputLabel>
              <Select
                value={relatedModule}
                label="Related Module"
                onChange={(e) => setRelatedModule(e.target.value)}
              >
                <MenuItem value="workspace">Workspace & General</MenuItem>
                <MenuItem value="crm">CRM & Contracts</MenuItem>
                <MenuItem value="sales">Sales & Quotations</MenuItem>
                <MenuItem value="purchase">Purchase & Invoices</MenuItem>
                <MenuItem value="finance">Finance & Auditing</MenuItem>
                <MenuItem value="hr">HR & Employee Policies</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadOutlinedIcon />}
            >
              Upload Document
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
