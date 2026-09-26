import React, { useState, useEffect, useCallback } from 'react';
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
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  Paper,
} from '@mui/material';

// Icons
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import calendarService from '../services/calendarService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

const EVENT_TYPE_CONFIG = {
  meeting: { label: 'Meeting', color: 'primary', icon: GroupsOutlinedIcon, bg: '#eff6ff', border: '#bfdbfe' },
  call: { label: 'Call', color: 'info', icon: PhoneInTalkOutlinedIcon, bg: '#f0fdf4', border: '#bbf7d0' },
  task: { label: 'Task', color: 'warning', icon: TaskAltOutlinedIcon, bg: '#fffbeb', border: '#fde68a' },
  reminder: { label: 'Reminder', color: 'secondary', icon: NotificationsActiveOutlinedIcon, bg: '#faf5ff', border: '#e9d5ff' },
  deadline: { label: 'Deadline', color: 'error', icon: WarningAmberOutlinedIcon, bg: '#fef2f2', border: '#fecaca' },
  holiday: { label: 'Holiday', color: 'success', icon: CalendarMonthOutlinedIcon, bg: '#ecfdf5', border: '#a7f3d0' },
  other: { label: 'Other', color: 'default', icon: CalendarMonthOutlinedIcon, bg: '#f8fafc', border: '#e2e8f0' },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const { currentCompany } = useCompany();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = Month, 1 = Agenda / List

  // Current view date
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState('all');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    start_time: '',
    end_time: '',
    all_day: false,
    location: '',
  });

  const fetchEvents = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    setError('');
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month + 2, 0).toISOString();

      const params = { start, end };
      if (selectedType !== 'all') {
        params.event_type = selectedType;
      }
      const data = await calendarService.getEvents(currentCompany.id, params);
      setEvents(data || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentDate, selectedType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openCreateModal = (datePrefill = null) => {
    const baseDate = datePrefill || new Date();
    const startStr = new Date(baseDate.setHours(9, 0, 0, 0)).toISOString().slice(0, 16);
    const endStr = new Date(baseDate.setHours(10, 0, 0, 0)).toISOString().slice(0, 16);

    setFormData({
      title: '',
      description: '',
      event_type: 'meeting',
      start_time: startStr,
      end_time: endStr,
      all_day: false,
      location: '',
    });
    setSelectedEvent(null);
    setCreateModalOpen(true);
  };

  const openEditModal = (event) => {
    setSelectedEvent(event);
    setFormData({
      title: event.title || '',
      description: event.description || '',
      event_type: event.event_type || 'meeting',
      start_time: event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '',
      end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '',
      all_day: event.all_day || false,
      location: event.location || '',
    });
    setEventDetailOpen(false);
    setCreateModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.start_time || !formData.end_time) {
      alert('Please provide title, start time, and end time.');
      return;
    }
    setSaving(true);
    try {
      if (selectedEvent) {
        await calendarService.updateEvent(currentCompany.id, selectedEvent.id, formData);
      } else {
        await calendarService.createEvent(currentCompany.id, formData);
      }
      setCreateModalOpen(false);
      fetchEvents();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await calendarService.deleteEvent(currentCompany.id, eventId);
      setEventDetailOpen(false);
      fetchEvents();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  // Calendar matrix calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Metrics
  const totalEvents = events.length;
  const meetingsCount = events.filter((e) => e.event_type === 'meeting').length;
  const tasksCount = events.filter((e) => e.event_type === 'task').length;
  const callsCount = events.filter((e) => e.event_type === 'call').length;

  if (!currentCompany) {
    return (
      <Box sx={{ p: 3 }}>
        <EmptyState
          title="No Company Selected"
          description="Please select a company workspace to view and manage calendar events."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        title="Calendar & Scheduling"
        subtitle="Coordinate corporate events, client meetings, shift deadlines, and sales appointments."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openCreateModal()}
            sx={{ fontWeight: 600 }}
          >
            New Event
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
            title="Total Events"
            value={totalEvents}
            icon={CalendarMonthOutlinedIcon}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Meetings"
            value={meetingsCount}
            icon={GroupsOutlinedIcon}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Calls & Follow-ups"
            value={callsCount}
            icon={PhoneInTalkOutlinedIcon}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tasks & Deadlines"
            value={tasksCount}
            icon={TaskAltOutlinedIcon}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Calendar Controls */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          {/* Month Navigation */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={handlePrevMonth} size="small" sx={{ border: '1px solid #e2e8f0' }}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton onClick={handleNextMonth} size="small" sx={{ border: '1px solid #e2e8f0' }}>
              <ChevronRightIcon />
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TodayIcon />}
              onClick={handleToday}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Today
            </Button>
            <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 200, pl: 1 }}>
              {MONTH_NAMES[month]} {year}
            </Typography>
          </Stack>

          {/* Filters & View Toggle */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              select
              size="small"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              label="Event Type"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Types</MenuItem>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </TextField>

            <Tabs
              value={activeTab}
              onChange={(e, val) => setActiveTab(val)}
              sx={{ minHeight: 38 }}
            >
              <Tab label="Month View" sx={{ minHeight: 38, textTransform: 'none', fontWeight: 600 }} />
              <Tab label="Agenda View" sx={{ minHeight: 38, textTransform: 'none', fontWeight: 600 }} />
            </Tabs>
          </Stack>
        </Stack>
      </Card>

      {loading ? (
        <LoadingState message="Loading calendar events..." />
      ) : activeTab === 0 ? (
        /* Month View Grid */
        <Card sx={{ overflow: 'hidden' }}>
          {/* Day of Week Headers */}
          <Grid container sx={{ bgcolor: 'grey.100', borderBottom: '1px solid #e2e8f0' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Grid
                item
                xs={12 / 7}
                key={d}
                sx={{
                  py: 1.5,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  color: 'text.secondary',
                }}
              >
                {d}
              </Grid>
            ))}
          </Grid>

          {/* Calendar Day Cells */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', bgcolor: '#f8fafc' }}>
            {/* Prev month fill days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayIndex + i + 1;
              return (
                <Box
                  key={`prev-${i}`}
                  sx={{
                    minHeight: 110,
                    p: 1,
                    borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    opacity: 0.35,
                    bgcolor: '#ffffff',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {dayNum}
                  </Typography>
                </Box>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const isToday =
                new Date().toDateString() === dateObj.toDateString();

              // Find events on this day
              const dayEvents = events.filter((ev) => {
                if (!ev.start_time) return false;
                const evDate = new Date(ev.start_time);
                return (
                  evDate.getFullYear() === year &&
                  evDate.getMonth() === month &&
                  evDate.getDate() === dayNum
                );
              });

              return (
                <Box
                  key={`day-${dayNum}`}
                  onClick={() => openCreateModal(dateObj)}
                  sx={{
                    minHeight: 110,
                    p: 1,
                    borderRight: '1px solid #e2e8f0',
                    borderBottom: '1px solid #e2e8f0',
                    bgcolor: isToday ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    '&:hover': {
                      bgcolor: isToday ? '#dcfce7' : '#f1f5f9',
                    },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: isToday ? 'success.main' : 'text.primary',
                        bgcolor: isToday ? '#bbf7d0' : 'transparent',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {dayNum}
                    </Typography>
                    {dayEvents.length > 0 && (
                      <Chip
                        label={dayEvents.length}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                      />
                    )}
                  </Stack>

                  {/* Day Events Stack */}
                  <Stack spacing={0.5}>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.other;
                      return (
                        <Box
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                            setEventDetailOpen(true);
                          }}
                          sx={{
                            p: 0.5,
                            borderRadius: 1,
                            bgcolor: cfg.bg,
                            border: `1px solid ${cfg.border}`,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            '&:hover': { opacity: 0.8 },
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: `${cfg.color}.main`,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ fontSize: '0.7rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {ev.title}
                          </Typography>
                        </Box>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
                        +{dayEvents.length - 3} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Card>
      ) : (
        /* Agenda / List View */
        <Stack spacing={2}>
          {events.length === 0 ? (
            <Card sx={{ p: 4 }}>
              <EmptyState
                title="No Events Scheduled"
                description="No events found for the selected time period or type filter."
                action={
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateModal()}>
                    Create First Event
                  </Button>
                }
              />
            </Card>
          ) : (
            events.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.event_type] || EVENT_TYPE_CONFIG.other;
              const IconComp = cfg.icon;
              const startDate = new Date(ev.start_time);
              const endDate = new Date(ev.end_time);

              return (
                <Card
                  key={ev.id}
                  sx={{
                    p: 2.5,
                    borderLeft: `4px solid`,
                    borderLeftColor: `${cfg.color}.main`,
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 3 },
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          bgcolor: cfg.bg,
                          color: `${cfg.color}.main`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconComp />
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {ev.title}
                          </Typography>
                          <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined" sx={{ fontWeight: 600 }} />
                        </Stack>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <AccessTimeOutlinedIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                              {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Stack>
                          {ev.location && (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <PlaceOutlinedIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {ev.location}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                        {ev.description && (
                          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                            {ev.description}
                          </Typography>
                        )}
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" onClick={() => openEditModal(ev)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteEvent(ev.id)}>
                        <DeleteOutlineOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Card>
              );
            })
          )}
        </Stack>
      )}

      {/* Event Details Dialog */}
      <Dialog open={eventDetailOpen} onClose={() => setEventDetailOpen(false)} maxWidth="sm" fullWidth>
        {selectedEvent && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {selectedEvent.title}
                </Typography>
                <Chip
                  label={EVENT_TYPE_CONFIG[selectedEvent.event_type]?.label || selectedEvent.event_type}
                  color={EVENT_TYPE_CONFIG[selectedEvent.event_type]?.color || 'default'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccessTimeOutlinedIcon sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {new Date(selectedEvent.start_time).toLocaleString()} — {new Date(selectedEvent.end_time).toLocaleString()}
                  </Typography>
                </Stack>
                {selectedEvent.location && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PlaceOutlinedIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2">{selectedEvent.location}</Typography>
                  </Stack>
                )}
                {selectedEvent.description && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Description
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedEvent.description}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Created by: {selectedEvent.created_by_name || 'System'}
                  </Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
              <Button
                color="error"
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() => handleDeleteEvent(selectedEvent.id)}
              >
                Delete
              </Button>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setEventDetailOpen(false)}>Close</Button>
                <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => openEditModal(selectedEvent)}>
                  Edit
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Create / Edit Event Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSaveEvent}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {selectedEvent ? 'Edit Calendar Event' : 'Schedule New Event'}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField
                required
                fullWidth
                label="Event Title"
                placeholder="e.g. Sales Review Meeting"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Event Type"
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  >
                    {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                      <MenuItem key={key} value={key}>
                        {config.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Location / Room"
                    placeholder="e.g. Conference Room B or Zoom"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    type="datetime-local"
                    label="Start Time"
                    InputLabelProps={{ shrink: true }}
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    type="datetime-local"
                    label="End Time"
                    InputLabelProps={{ shrink: true }}
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.all_day}
                    onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                  />
                }
                label="All-day event"
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description & Agenda"
                placeholder="Key meeting objectives, call notes, or task requirements..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving...' : selectedEvent ? 'Save Changes' : 'Schedule Event'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
