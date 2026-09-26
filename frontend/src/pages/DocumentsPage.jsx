import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
  Tabs,
  Tab,
  Alert,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import documentService from '../services/documentService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const CATEGORIES = [
  { id: 'all', label: 'All Documents' },
  { id: 'contract', label: 'Contracts' },
  { id: 'nda', label: 'NDAs' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'quotation', label: 'Quotations' },
  { id: 'employee', label: 'Employee Records' },
  { id: 'financial', label: 'Financial' },
  { id: 'general', label: 'General' },
];

export default function DocumentsPage() {
  const { currentCompany } = useCompany();
  const fileInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadData, setUploadData] = useState({
    name: '',
    category: 'general',
    tags: '',
  });

  // Edit metadata modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editData, setEditData] = useState({ name: '', category: 'general', tags: '' });

  const fetchDocuments = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const params = { page, page_size: 50 };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      const data = await documentService.getDocuments(currentCompany.id, params);
      setDocuments(data.results || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, page, selectedCategory, search]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert('File size exceeds the 25 MB maximum limit.');
        return;
      }
      setSelectedFile(file);
      if (!uploadData.name) {
        setUploadData((prev) => ({ ...prev, name: file.name }));
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (uploadData.name) fd.append('name', uploadData.name);
      if (uploadData.category) fd.append('category', uploadData.category);
      if (uploadData.tags) fd.append('tags', uploadData.tags);

      await documentService.uploadDocument(currentCompany.id, fd);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setUploadData({ name: '', category: 'general', tags: '' });
      fetchDocuments();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await documentService.deleteDocument(currentCompany.id, docId);
      fetchDocuments();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setEditData({
      name: doc.name || '',
      category: doc.category || 'general',
      tags: doc.tags || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await documentService.updateDocument(currentCompany.id, editingDoc.id, editData);
      setEditModalOpen(false);
      fetchDocuments();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  // Metrics
  const contractsCount = documents.filter((d) => ['contract', 'nda'].includes(d.category?.toLowerCase())).length;
  const financialCount = documents.filter((d) => ['invoice', 'quotation', 'financial'].includes(d.category?.toLowerCase())).length;
  const totalSizeBytes = documents.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const totalSizeFormatted =
    totalSizeBytes < 1024 * 1024
      ? `${(totalSizeBytes / 1024).toFixed(1)} KB`
      : `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`;

  if (!currentCompany) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="No Company Selected"
          description="Please select a company workspace to view and manage documents."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Document Management"
        subtitle="Central corporate repository for contracts, invoices, compliance archives, NDAs, and quotes."
        action={
          <Button
            variant="contained"
            startIcon={<CloudUploadOutlinedIcon />}
            onClick={() => {
              setSelectedFile(null);
              setUploadData({ name: '', category: 'general', tags: '' });
              setUploadModalOpen(true);
            }}
            sx={{ fontWeight: 600 }}
          >
            Upload Document
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Documents"
            value={totalCount}
            icon={DescriptionOutlinedIcon}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Storage Used"
            value={totalSizeFormatted}
            icon={StorageOutlinedIcon}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Contracts & NDAs"
            value={contractsCount}
            icon={GavelOutlinedIcon}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Billing & Quotations"
            value={financialCount}
            icon={ReceiptLongOutlinedIcon}
            color="success"
          />
        </Grid>
      </Grid>

      {/* Filter & Category Controls */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search documents by filename, tags, or extension..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Tabs
          value={selectedCategory}
          onChange={(e, val) => setSelectedCategory(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          {CATEGORIES.map((c) => (
            <Tab
              key={c.id}
              value={c.id}
              label={c.label}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            />
          ))}
        </Tabs>
      </Card>

      {/* Documents Table */}
      {loading ? (
        <LoadingState message="Loading documents..." />
      ) : documents.length === 0 ? (
        <Card sx={{ p: 4 }}>
          <EmptyState
            title="No Documents Found"
            description={
              search
                ? `No documents matching "${search}".`
                : "No documents have been uploaded in this category."
            }
            action={
              <Button
                variant="contained"
                startIcon={<CloudUploadOutlinedIcon />}
                onClick={() => setUploadModalOpen(true)}
              >
                Upload First Document
              </Button>
            }
          />
        </Card>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'background.subtle' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Document Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Format / Size</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tags</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Uploaded By</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => {
                const downloadUrl = documentService.getDownloadUrl(currentCompany.id, doc.id);
                return (
                  <TableRow key={doc.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.5,
                            bgcolor: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'primary.main',
                          }}
                        >
                          {doc.file_type === 'PDF' ? (
                            <PictureAsPdfOutlinedIcon fontSize="small" sx={{ color: '#ef4444' }} />
                          ) : ['XLS', 'XLSX', 'CSV'].includes(doc.file_type) ? (
                            <TableChartOutlinedIcon fontSize="small" sx={{ color: '#10b981' }} />
                          ) : (
                            <InsertDriveFileOutlinedIcon fontSize="small" />
                          )}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {doc.name}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.category_display || doc.category || 'General'}
                        size="small"
                        color={
                          doc.category === 'contract'
                            ? 'warning'
                            : doc.category === 'invoice'
                            ? 'success'
                            : 'default'
                        }
                        sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {doc.file_type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.file_size_formatted || `${(doc.file_size / 1024).toFixed(1)} KB`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {doc.tags ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {doc.tags.split(',').map((t, idx) => (
                            <Chip key={idx} label={t.trim()} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{doc.uploaded_by_name || 'System'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Download">
                          <IconButton
                            size="small"
                            color="primary"
                            component="a"
                            href={downloadUrl}
                            download
                          >
                            <FileDownloadOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Tags & Category">
                          <IconButton size="small" onClick={() => handleOpenEdit(doc)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Document">
                          <IconButton size="small" color="error" onClick={() => handleDelete(doc.id)}>
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Document Modal */}
      <Dialog open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleUploadSubmit}>
          <DialogTitle sx={{ fontWeight: 700 }}>Upload Enterprise Document</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              {/* File Select Area */}
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: selectedFile ? '#f0fdf4' : 'background.subtle',
                  borderColor: selectedFile ? '#22c55e' : '#cbd5e1',
                  '&:hover': { bgcolor: '#f1f5f9' },
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <CloudUploadOutlinedIcon sx={{ fontSize: '2.5rem', color: selectedFile ? 'success.main' : 'primary.main', mb: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedFile ? selectedFile.name : 'Choose a file or drag & drop here'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  PDF, DOC, DOCX, XLS, XLSX, CSV, PNG, JPG, ZIP (Max 25 MB)
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="Custom Document Name (Optional)"
                placeholder="Leave blank to use original filename"
                value={uploadData.name}
                onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
              />

              <TextField
                select
                fullWidth
                label="Category"
                value={uploadData.category}
                onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="Tags (Comma separated)"
                placeholder="e.g. Q3, confidential, renewal, vendor"
                value={uploadData.tags}
                onChange={(e) => setUploadData({ ...uploadData, tags: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setUploadModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={uploading || !selectedFile}>
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Metadata Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveEdit}>
          <DialogTitle sx={{ fontWeight: 700 }}>Edit Document Details</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField
                required
                fullWidth
                label="Document Name"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />

              <TextField
                select
                fullWidth
                label="Category"
                value={editData.category}
                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                label="Tags"
                placeholder="e.g. signed, contract, 2026"
                value={editData.tags}
                onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
