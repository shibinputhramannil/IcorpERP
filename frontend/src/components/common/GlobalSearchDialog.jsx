import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  InputBase,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';
import searchService from '../../services/searchService';

const CATEGORY_CONFIG = {
  companies: { label: 'Companies', icon: BusinessOutlinedIcon, color: '#2563eb' },
  employees: { label: 'Employees', icon: BadgeOutlinedIcon, color: '#059669' },
  customers: { label: 'Customers', icon: PeopleAltOutlinedIcon, color: '#7c3aed' },
  leads: { label: 'Leads', icon: PersonSearchOutlinedIcon, color: '#d97706' },
  deals: { label: 'Deals', icon: HandshakeOutlinedIcon, color: '#ea580c' },
  products: { label: 'Products', icon: Inventory2OutlinedIcon, color: '#0891b2' },
  sales: { label: 'Sales Invoices', icon: PointOfSaleOutlinedIcon, color: '#16a34a' },
  purchases: { label: 'Purchase Bills', icon: ShoppingCartOutlinedIcon, color: '#4f46e5' },
  documents: { label: 'Documents', icon: DescriptionOutlinedIcon, color: '#dc2626' },
  notes: { label: 'Notes', icon: StickyNote2OutlinedIcon, color: '#ca8a04' },
  calendar: { label: 'Calendar Events', icon: CalendarMonthOutlinedIcon, color: '#0284c7' },
};

export default function GlobalSearchDialog({ open, onClose, activeCompany }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [totalResults, setTotalResults] = useState(0);
  const [selectedScope, setSelectedScope] = useState('all'); // 'all' or 'active'
  const inputRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } else {
      setQuery('');
      setResults({});
      setTotalResults(0);
      setLoading(false);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({});
      setTotalResults(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const companyId = selectedScope === 'active' && activeCompany ? activeCompany.id : null;
        const resp = await searchService.globalSearch(trimmed, companyId);
        setResults(resp.results || {});
        setTotalResults(resp.total_results || 0);
      } catch (err) {
        console.error('Global search error:', err);
        setResults({});
        setTotalResults(0);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, selectedScope, activeCompany, open]);

  const handleSelect = (item) => {
    onClose();
    if (item.url) {
      navigate(item.url);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      onKeyDown={handleKeyDown}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          top: { xs: 20, sm: 60 },
          position: 'absolute',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      {/* Search Input Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
        }}
      >
        <SearchIcon sx={{ color: 'text.secondary', fontSize: 24, mr: 1.5 }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ERP (companies, staff, leads, invoices, files...)"
          fullWidth
          sx={{
            fontSize: '1rem',
            color: 'text.primary',
            '& input': {
              p: 0,
            },
          }}
        />
        {loading && <CircularProgress size={20} sx={{ mr: 1.5, color: 'text.secondary' }} />}
        {query && !loading && (
          <IconButton size="small" onClick={() => setQuery('')} sx={{ mr: 1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
        <Chip
          label="ESC"
          size="small"
          onClick={onClose}
          sx={{
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: '#f1f5f9',
            color: 'text.secondary',
          }}
        />
      </Box>

      {/* Scope Switcher Bar */}
      <Box
        sx={{
          px: 2.5,
          py: 1,
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Scope:
        </Typography>
        <Chip
          label="🌐 All Workspaces"
          size="small"
          clickable
          color={selectedScope === 'all' ? 'primary' : 'default'}
          variant={selectedScope === 'all' ? 'filled' : 'outlined'}
          onClick={() => setSelectedScope('all')}
          sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }}
        />
        {activeCompany && (
          <Chip
            label={`🏢 ${activeCompany.name}`}
            size="small"
            clickable
            color={selectedScope === 'active' ? 'primary' : 'default'}
            variant={selectedScope === 'active' ? 'filled' : 'outlined'}
            onClick={() => setSelectedScope('active')}
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600 }}
          />
        )}
        {totalResults > 0 && (
          <Box sx={{ ml: 'auto' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {totalResults} {totalResults === 1 ? 'match' : 'matches'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Dialog Body / Results */}
      <DialogContent sx={{ p: 0, maxHeight: 440, minHeight: 180, overflowY: 'auto' }}>
        {query.trim().length < 2 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, fontWeight: 500 }}>
              Type at least 2 characters to search across all ERP modules.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Chip label="Companies" size="small" onClick={() => setQuery('corp')} sx={{ cursor: 'pointer' }} />
              <Chip label="Staff" size="small" onClick={() => setQuery('emp')} sx={{ cursor: 'pointer' }} />
              <Chip label="Invoices" size="small" onClick={() => setQuery('inv')} sx={{ cursor: 'pointer' }} />
              <Chip label="Contracts" size="small" onClick={() => setQuery('doc')} sx={{ cursor: 'pointer' }} />
            </Stack>
          </Box>
        ) : loading && Object.keys(results).length === 0 ? (
          <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 1.5 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Searching authorized records...
            </Typography>
          </Box>
        ) : totalResults === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              No results found
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No matches for "{query}". Check spelling or try a broader term.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ py: 1 }}>
            {Object.entries(results).map(([catKey, items]) => {
              if (!items || items.length === 0) return null;
              const config = CATEGORY_CONFIG[catKey] || {
                label: catKey.toUpperCase(),
                icon: BusinessOutlinedIcon,
                color: '#64748b',
              };
              const CatIcon = config.icon;

              return (
                <Box key={catKey} sx={{ mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 2.5,
                      py: 0.5,
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {config.label} ({items.length})
                  </Typography>
                  <List disablePadding>
                    {items.map((item) => (
                      <ListItemButton
                        key={`${catKey}-${item.id}`}
                        onClick={() => handleSelect(item)}
                        sx={{
                          px: 2.5,
                          py: 1,
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: 1,
                              backgroundColor: `${config.color}15`,
                              color: config.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CatIcon sx={{ fontSize: 16 }} />
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                {item.title}
                              </Typography>
                              <Chip
                                label={item.type}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.625rem',
                                  fontWeight: 600,
                                  backgroundColor: '#f1f5f9',
                                  color: 'text.secondary',
                                }}
                              />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                              {item.subtitle}
                            </Typography>
                          }
                        />
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {item.company_name && (
                            <Chip
                              label={item.company_name}
                              size="small"
                              variant="outlined"
                              sx={{
                                height: 20,
                                fontSize: '0.625rem',
                                maxWidth: 120,
                                display: { xs: 'none', sm: 'inline-flex' },
                              }}
                            />
                          )}
                          <ArrowForwardIosIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                        </Stack>
                      </ListItemButton>
                    ))}
                  </List>
                  <Divider sx={{ mt: 1, borderColor: '#f1f5f9' }} />
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
