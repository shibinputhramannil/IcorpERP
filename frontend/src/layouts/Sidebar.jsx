import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

// Icons
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import AlternateEmailOutlinedIcon from '@mui/icons-material/AlternateEmailOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export const DRAWER_WIDTH = 260;

const NAV_GROUPS = [
  {
    title: 'CORE MANAGEMENT',
    items: [
      { text: 'Dashboard', path: '/dashboard', icon: DashboardOutlinedIcon, status: 'live' },
      { text: 'Companies', path: '/companies', icon: BusinessOutlinedIcon, status: 'live' },
      { text: 'Employees', path: '/employees', icon: BadgeOutlinedIcon, status: 'live' },
      { text: 'CRM', path: '/crm', icon: PeopleAltOutlinedIcon, status: 'live' },
    ],
  },
  {
    title: 'OPERATIONS & WORKFLOWS',
    items: [
      { text: 'Inventory', path: '/inventory', icon: Inventory2OutlinedIcon, status: 'live' },
      { text: 'Sales', path: '/sales', icon: PointOfSaleOutlinedIcon, status: 'live' },
      { text: 'Purchase', path: '/purchase', icon: ShoppingCartOutlinedIcon, status: 'upcoming' },
      { text: 'Finance', path: '/finance', icon: AccountBalanceWalletOutlinedIcon, status: 'upcoming' },
    ],
  },
  {
    title: 'WORKSPACE & COLLABORATION',
    items: [
      { text: 'Calendar', path: '/calendar', icon: CalendarMonthOutlinedIcon, status: 'upcoming' },
      { text: 'Notes', path: '/notes', icon: StickyNote2OutlinedIcon, status: 'upcoming' },
      { text: 'Email', path: '/email', icon: AlternateEmailOutlinedIcon, status: 'upcoming' },
      { text: 'Documents', path: '/documents', icon: DescriptionOutlinedIcon, status: 'upcoming' },
    ],
  },
  {
    title: 'SYSTEM & INTELLIGENCE',
    items: [
      { text: 'AI Assistant', path: '/ai-assistant', icon: AutoAwesomeOutlinedIcon, status: 'upcoming' },
      { text: 'Settings', path: '/settings', icon: SettingsOutlinedIcon, status: 'upcoming' },
    ],
  },
];

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    navigate(path);
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand Header */}
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          px: 3,
          borderBottom: '1px solid #e2e8f0',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            backgroundColor: 'primary.main',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
          }}
        >
          IC
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
            ICORP ERP
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            Enterprise Suite
          </Typography>
        </Box>
      </Box>

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {NAV_GROUPS.map((group, groupIdx) => (
          <Box key={group.title} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                mb: 1,
                display: 'block',
                fontSize: '0.675rem',
                fontWeight: 700,
                color: 'text.secondary',
                letterSpacing: '0.08em',
              }}
            >
              {group.title}
            </Typography>

            <List disablePadding>
              {group.items.map((item) => {
                const isSelected =
                  location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                const IconComponent = item.icon;

                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={isSelected}
                      onClick={() => handleNavigate(item.path)}
                      sx={{
                        py: 1,
                        px: 1.5,
                        borderRadius: 1.5,
                        '&.Mui-selected': {
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          '&:hover': {
                            backgroundColor: '#dbeafe',
                          },
                          '& .MuiListItemIcon-root': {
                            color: '#1d4ed8',
                          },
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          color: isSelected ? 'primary.main' : 'text.secondary',
                        }}
                      >
                        <IconComponent fontSize="small" />
                      </ListItemIcon>

                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 600 : 500,
                        }}
                      />

                      {item.status === 'live' && (
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: 'success.main',
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {groupIdx < NAV_GROUPS.length - 1 && <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />}
          </Box>
        ))}
      </Box>

      {/* Footer Info */}
      <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            v1.0.0
          </Typography>
          <Chip label="PostgreSQL" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Temporary Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: '1px solid #e2e8f0',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Permanent Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            borderRight: '1px solid #e2e8f0',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}
