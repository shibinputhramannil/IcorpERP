import api from './api';

export const calendarService = {
  /**
   * List calendar events for a company with optional filters.
   */
  getEvents: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/calendar/events/`, { params });
    return response.data;
  },

  /**
   * Create a new calendar event.
   */
  createEvent: async (companyId, eventData) => {
    const response = await api.post(`/companies/${companyId}/calendar/events/`, eventData);
    return response.data;
  },

  /**
   * Get single calendar event detail.
   */
  getEvent: async (companyId, eventId) => {
    const response = await api.get(`/companies/${companyId}/calendar/events/${eventId}/`);
    return response.data;
  },

  /**
   * Update an existing calendar event.
   */
  updateEvent: async (companyId, eventId, eventData) => {
    const response = await api.patch(`/companies/${companyId}/calendar/events/${eventId}/`, eventData);
    return response.data;
  },

  /**
   * Delete a calendar event.
   */
  deleteEvent: async (companyId, eventId) => {
    const response = await api.delete(`/companies/${companyId}/calendar/events/${eventId}/`);
    return response.data;
  },

  /**
   * Get upcoming scheduled events.
   */
  getUpcomingEvents: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/calendar/upcoming/`);
    return response.data;
  },
};

export default calendarService;
