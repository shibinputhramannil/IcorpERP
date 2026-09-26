import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Avatar,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

// Icons
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import aiService from '../services/aiService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

// ============================================================
// 10 EXAMPLE PROMPTS FROM REQUIREMENTS
// ============================================================
const QUICK_PROMPTS = [
  { label: "What are this month's sales?", category: "Sales" },
  { label: "Which invoices are outstanding?", category: "Sales" },
  { label: "How much did we collect?", category: "Finance" },
  { label: "What are our total purchases?", category: "Purchase" },
  { label: "Which products have low stock?", category: "Inventory" },
  { label: "Which customers owe money?", category: "CRM" },
  { label: "Which vendors have the highest purchase value?", category: "Purchase" },
  { label: "What is the current profit?", category: "Finance" },
  { label: "Show recent sales orders.", category: "Sales" },
  { label: "Show recent purchase orders.", category: "Purchase" },
];

// ============================================================
// LIGHTWEIGHT MARKDOWN / TABLE RENDERER COMPONENT
// ============================================================
function FormattedMessageContent({ content }) {
  if (!content) return null;

  // Split lines
  const lines = content.split('\n');
  const elements = [];
  let tableLines = [];
  let inTable = false;

  const flushTable = (key) => {
    if (tableLines.length === 0) return;
    const headerLine = tableLines[0];
    const dataLines = tableLines.slice(2); // Skip separator line

    const headers = headerLine
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    elements.push(
      <TableContainer
        key={key}
        component={Paper}
        variant="outlined"
        sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden' }}
      >
        <Table size="small">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              {headers.map((h, i) => (
                <TableCell key={i} sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                  {formatInlineText(h)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {dataLines.map((rowLine, rIdx) => {
              const cells = rowLine
                .split('|')
                .map((s) => s.trim())
                .filter(Boolean);
              return (
                <TableRow key={rIdx} hover>
                  {cells.map((c, cIdx) => (
                    <TableCell key={cIdx} sx={{ fontSize: '0.8rem' }}>
                      {formatInlineText(c)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
    tableLines = [];
    inTable = false;
  };

  const formatInlineText = (text) => {
    // Process bold **text** and inline code `code`
    const parts = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      // Check bold
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Check code
      const codeMatch = remaining.match(/`(.*?)`/);

      let firstMatch = null;
      let matchType = null;

      if (boldMatch && (!codeMatch || boldMatch.index < codeMatch.index)) {
        firstMatch = boldMatch;
        matchType = 'bold';
      } else if (codeMatch) {
        firstMatch = codeMatch;
        matchType = 'code';
      }

      if (firstMatch) {
        const pre = remaining.slice(0, firstMatch.index);
        if (pre) parts.push(<span key={idx++}>{pre}</span>);

        if (matchType === 'bold') {
          parts.push(<strong key={idx++} style={{ fontWeight: 700 }}>{firstMatch[1]}</strong>);
        } else {
          parts.push(
            <Box
              key={idx++}
              component="code"
              sx={{
                backgroundColor: 'action.hover',
                px: 0.6,
                py: 0.2,
                borderRadius: 1,
                fontSize: '0.85em',
                fontFamily: 'monospace',
                color: 'primary.dark',
              }}
            >
              {firstMatch[1]}
            </Box>
          );
        }
        remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
      } else {
        parts.push(<span key={idx++}>{remaining}</span>);
        break;
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Markdown Table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      tableLines.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable(`tbl-${i}`);
    }

    if (line.startsWith('### ')) {
      elements.push(
        <Typography key={`h3-${i}`} variant="subtitle1" sx={{ fontWeight: 700, mt: 1.5, mb: 0.5, color: 'primary.main' }}>
          {formatInlineText(line.replace('### ', ''))}
        </Typography>
      );
    } else if (line.startsWith('#### ')) {
      elements.push(
        <Typography key={`h4-${i}`} variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5, color: 'text.primary' }}>
          {formatInlineText(line.replace('#### ', ''))}
        </Typography>
      );
    } else if (line.trim().startsWith('- ')) {
      elements.push(
        <Box key={`li-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.4 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'primary.main', mt: 1, mr: 1.5, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            {formatInlineText(line.trim().replace('- ', ''))}
          </Typography>
        </Box>
      );
    } else if (line.trim()) {
      elements.push(
        <Typography key={`p-${i}`} variant="body2" sx={{ my: 0.5, lineHeight: 1.6 }}>
          {formatInlineText(line)}
        </Typography>
      );
    }
  }

  if (inTable) {
    flushTable(`tbl-end`);
  }

  return <Box>{elements}</Box>;
}

// ============================================================
// MAIN AI ASSISTANT PAGE COMPONENT
// ============================================================
export default function AIAssistantPage() {
  const { activeCompany, loading: companyLoading } = useCompany();

  // Active Tab: 0 = Chat, 1 = Executive Digest, 2 = Entity Lookup
  const [currentTab, setCurrentTab] = useState(0);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "👋 Hello! I am your ICORP ERP Assistant. I can analyze sales orders, monitor inventory, check cash collections, track vendor spend, and report company profit.\n\nAsk me anything or select one of the suggested prompts below.",
      suggestedQuestions: [
        "What are this month's sales?",
        "Which invoices are outstanding?",
        "Which products have low stock?",
        "What is the current profit?",
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Executive Insights State
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  // Entity Lookup State
  const [lookupType, setLookupType] = useState('customer'); // 'customer' | 'vendor'
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSearched, setLookupSearched] = useState(false);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentTab === 0) {
      scrollToBottom();
    }
  }, [messages, currentTab]);

  // Load Executive Insights
  const loadExecutiveInsights = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      const data = await aiService.getInsights(activeCompany.id);
      setInsightsData(data);
    } catch (err) {
      console.error('Failed to load AI insights:', err);
      setInsightsError(extractErrorMessage(err));
    } finally {
      setInsightsLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    if (currentTab === 1 && !insightsData && activeCompany?.id) {
      loadExecutiveInsights();
    }
  }, [currentTab, insightsData, activeCompany?.id, loadExecutiveInsights]);

  // Handle Send Chat Query
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isSending) return;

    const userMessageId = Date.now();
    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(newMessages);
    setInputQuery('');
    setIsSending(true);

    try {
      // Build conversation history payload
      const historyPayload = newMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await aiService.chat(activeCompany?.id || null, query, historyPayload);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: res.answer,
          intent: res.intent,
          data: res.data,
          suggestedQuestions: res.suggested_questions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('AI chat failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ Error: ${extractErrorMessage(err) || "Could not retrieve ERP data for this inquiry. Please try again."}`,
          isError: true,
          suggestedQuestions: ["What are this month's sales?", "What is the current profit?"],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'ai',
        text: "Conversation cleared. Feel free to ask a new question about your business operations.",
        suggestedQuestions: [
          "What are this month's sales?",
          "Which invoices are outstanding?",
          "Which products have low stock?",
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Handle Entity Lookup
  const handleEntitySearch = async (e) => {
    e?.preventDefault();
    if (!lookupQuery.trim() || !activeCompany?.id) return;
    try {
      setLookupLoading(true);
      setLookupSearched(true);
      if (lookupType === 'customer') {
        const res = await aiService.lookupCustomer(activeCompany.id, lookupQuery.trim());
        setLookupResults(res.results || []);
      } else {
        const res = await aiService.lookupVendor(activeCompany.id, lookupQuery.trim());
        setLookupResults(res.results || []);
      }
    } catch (err) {
      console.error('Lookup search error:', err);
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  if (companyLoading) {
    return <LoadingState message="Loading company context..." />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page Header */}
      <PageHeader
        title="AI ERP Assistant"
        subtitle="Practical read-only telemetry, operational answers, and entity intelligence."
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<ShieldOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              label="Read-Only Engine"
              color="success"
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
            />
            <Chip
              icon={<BusinessOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
              label={activeCompany ? activeCompany.name : 'Global Workspace'}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Stack>
        }
      />

      {/* Security and Read-Only Banner */}
      <Alert
        severity="info"
        icon={<ShieldOutlinedIcon fontSize="inherit" />}
        sx={{ mb: 2.5, borderRadius: 2 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          <strong>Safe Operational Intelligence:</strong> The AI Assistant strictly inspects live ERP database records for <strong>{activeCompany.name}</strong> without modifying stock counts, deleting entries, or altering invoices or payments.
        </Typography>
      </Alert>

      {/* Navigation Tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="ERP AI Chat" />
          <Tab icon={<AccountBalanceWalletOutlinedIcon />} iconPosition="start" label="Executive Digest" />
          <Tab icon={<PeopleAltOutlinedIcon />} iconPosition="start" label="Customer & Vendor Lookup" />
        </Tabs>
      </Paper>

      {/* ============================================================
          TAB 0: ERP AI CHAT
          ============================================================ */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          {/* Quick Prompts Bar (Top on all devices) */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                ⚡ POPULAR ERP QUESTIONS:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {QUICK_PROMPTS.map((prompt) => (
                  <Chip
                    key={prompt.label}
                    label={prompt.label}
                    onClick={() => handleSendMessage(prompt.label)}
                    clickable
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{
                      fontWeight: 500,
                      borderRadius: 1.5,
                      '&:hover': { backgroundColor: 'primary.light', color: 'primary.contrastText' },
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Main Chat Stream */}
          <Grid size={{ xs: 12 }}>
            <Card variant="outlined" sx={{ borderRadius: 2.5, display: 'flex', flexDirection: 'column', height: '70vh' }}>
              {/* Chat Header Actions */}
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    <SmartToyOutlinedIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Operational Intelligence Stream
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Context: {activeCompany.name} (Live DB)
                    </Typography>
                  </Box>
                </Stack>
                <Tooltip title="Clear Conversation">
                  <IconButton size="small" onClick={handleClearChat} color="default">
                    <DeleteSweepOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Chat Messages Body */}
              <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                <Stack spacing={2.5}>
                  {messages.map((msg) => (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                          maxWidth: { xs: '95%', md: '80%' },
                          flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: msg.sender === 'user' ? 'secondary.main' : 'primary.main',
                            flexShrink: 0,
                          }}
                        >
                          {msg.sender === 'user' ? <PersonOutlinedIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
                        </Avatar>

                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            backgroundColor: msg.sender === 'user' ? 'primary.main' : '#ffffff',
                            color: msg.sender === 'user' ? '#ffffff' : 'text.primary',
                            border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          {msg.sender === 'user' ? (
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {msg.text}
                            </Typography>
                          ) : (
                            <FormattedMessageContent content={msg.text} />
                          )}

                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5, gap: 1, alignItems: 'center' }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.675rem',
                                color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                              }}
                            >
                              {msg.timestamp}
                            </Typography>
                            {msg.sender === 'ai' && (
                              <Tooltip title="Copy Text">
                                <IconButton
                                  size="small"
                                  onClick={() => navigator.clipboard.writeText(msg.text)}
                                  sx={{ p: 0.2, color: 'text.secondary' }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Paper>
                      </Stack>

                      {/* Suggested Questions below AI responses */}
                      {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                        <Box sx={{ pl: 6, pt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                          {msg.suggestedQuestions.map((q) => (
                            <Chip
                              key={q}
                              label={q}
                              size="small"
                              variant="outlined"
                              onClick={() => handleSendMessage(q)}
                              clickable
                              sx={{
                                fontSize: '0.725rem',
                                borderRadius: 1.5,
                                backgroundColor: '#ffffff',
                                borderColor: '#cbd5e1',
                                '&:hover': { borderColor: 'primary.main', backgroundColor: '#f1f5f9' },
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}

                  {isSending && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                        <AutoAwesomeIcon fontSize="small" />
                      </Avatar>
                      <Paper variant="outlined" sx={{ px: 2, py: 1.2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={16} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          Retrieving ERP telemetry...
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Stack>
              </Box>

              {/* Chat Input Bar */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Ask about sales, low stock, profits, debts, or 'Lookup customer Acme'..."
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      disabled={isSending}
                      autoComplete="off"
                      slotProps={{
                        input: {
                          sx: { borderRadius: 2 },
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={!inputQuery.trim() || isSending}
                      endIcon={isSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                      sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 600 }}
                    >
                      Ask
                    </Button>
                  </Stack>
                </form>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ============================================================
          TAB 1: EXECUTIVE ERP DIGEST
          ============================================================ */}
      {currentTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Real-Time Operational Digest
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Consolidated operational telemetry across Sales, Purchases, Inventory, and Financial Ledgers.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadExecutiveInsights}
              disabled={insightsLoading}
              size="small"
              sx={{ borderRadius: 2 }}
            >
              Refresh Data
            </Button>
          </Box>

          {insightsLoading ? (
            <LoadingState message="Generating executive digest from live ledgers..." />
          ) : insightsError ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>{insightsError}</Alert>
          ) : insightsData ? (
            <Grid container spacing={3}>
              {/* Sales Metric Card */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Month Sales"
                  value={insightsData.sales?.month_sales_formatted || '$0.00'}
                  subtitle={`${insightsData.sales?.month_invoice_count || 0} invoices issued`}
                  icon={PointOfSaleOutlinedIcon}
                  color="primary"
                />
              </Grid>

              {/* Total Purchases Card */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Total Purchases"
                  value={insightsData.purchases?.total_purchases_formatted || '$0.00'}
                  subtitle={`Unpaid bills: ${insightsData.purchases?.unpaid_bills_formatted || '$0.00'}`}
                  icon={ShoppingCartOutlinedIcon}
                  color="warning"
                />
              </Grid>

              {/* Net Profit Card */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Current Net Profit"
                  value={insightsData.finance?.net_profit_formatted || '$0.00'}
                  subtitle={`Gross profit: ${insightsData.finance?.gross_profit_formatted || '$0.00'}`}
                  icon={AccountBalanceWalletOutlinedIcon}
                  color="success"
                />
              </Grid>

              {/* Liquid Capital Card */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                  title="Liquid Funds (Cash+Bank)"
                  value={insightsData.finance?.liquid_funds_formatted || '$0.00'}
                  subtitle={`Receivables: ${insightsData.finance?.receivables_formatted || '$0.00'}`}
                  icon={BusinessOutlinedIcon}
                  color="info"
                />
              </Grid>

              {/* Inventory Health Breakdown */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2.5, height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'warning.light', color: 'warning.dark', width: 36, height: 36 }}>
                        <Inventory2OutlinedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Inventory Stock Health
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Valuation: {insightsData.inventory?.total_valuation_formatted || '$0.00'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                          <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>
                            {insightsData.inventory?.low_stock_count || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Low-Stock Products
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                          <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {insightsData.inventory?.out_of_stock_count || 0}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Out of Stock SKUs
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {insightsData.inventory?.low_stock_items?.length > 0 && (
                      <Box sx={{ mt: 2.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          ITEMS NEEDING REORDER:
                        </Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          {insightsData.inventory.low_stock_items.slice(0, 5).map((item) => (
                            <Box
                              key={item.id}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                p: 1,
                                bgcolor: 'action.hover',
                                borderRadius: 1.5,
                              }}
                            >
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>SKU: {item.sku}</Typography>
                              </Box>
                              <Chip
                                label={`${item.current_stock} / reorder at ${item.reorder_level}`}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Financial Balance Sheet Overview */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2.5, height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'success.light', color: 'success.dark', width: 36, height: 36 }}>
                        <AccountBalanceWalletOutlinedIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Financial Obligations & Collections
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Accounting Ledgers
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />

                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Accounts Receivable (A/R)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {insightsData.finance?.receivables_formatted || '$0.00'}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Accounts Payable (A/P)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                              {insightsData.finance?.payables_formatted || '$0.00'}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Total Revenue (Operating)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {insightsData.finance?.revenue_total_formatted || '$0.00'}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Total Operating Expenses</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {insightsData.finance?.expenses_total_formatted || '$0.00'}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}
        </Box>
      )}

      {/* ============================================================
          TAB 2: CUSTOMER & VENDOR INTELLIGENCE LOOKUP
          ============================================================ */}
      {currentTab === 2 && (
        <Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Entity Intelligence Hub
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Quick profile lookup for customers and suppliers with order histories, total billing, and outstanding debts.
            </Typography>
          </Box>

          {/* Search Form */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <form onSubmit={handleEntitySearch}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth
                      variant={lookupType === 'customer' ? 'contained' : 'outlined'}
                      onClick={() => {
                        setLookupType('customer');
                        setLookupResults([]);
                        setLookupSearched(false);
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Customer
                    </Button>
                    <Button
                      fullWidth
                      variant={lookupType === 'vendor' ? 'contained' : 'outlined'}
                      onClick={() => {
                        setLookupType('vendor');
                        setLookupResults([]);
                        setLookupSearched(false);
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Vendor
                    </Button>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 7 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`Search ${lookupType} by name, email, or phone...`}
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2 },
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={!lookupQuery.trim() || lookupLoading}
                    startIcon={lookupLoading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                  >
                    Lookup
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {/* Results Area */}
          {lookupLoading ? (
            <LoadingState message={`Searching ${lookupType} records...`} />
          ) : lookupSearched && lookupResults.length === 0 ? (
            <EmptyState
              title={`No ${lookupType === 'customer' ? 'Customer' : 'Vendor'} Found`}
              description={`No matching records found for query "${lookupQuery}". Verify the spelling or search using another keyword.`}
            />
          ) : (
            <Grid container spacing={2.5}>
              {lookupResults.map((item) => (
                <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Avatar sx={{ bgcolor: lookupType === 'customer' ? 'primary.main' : 'warning.main' }}>
                          {lookupType === 'customer' ? <PersonOutlinedIcon /> : <BusinessOutlinedIcon />}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {item.email || 'No email'} • {item.phone || 'No phone'}
                          </Typography>
                        </Box>
                        {lookupType === 'customer' && (
                          <Chip label={item.customer_type || 'Customer'} size="small" variant="outlined" />
                        )}
                        {lookupType === 'vendor' && item.tax_id && (
                          <Chip label={`Tax: ${item.tax_id}`} size="small" variant="outlined" />
                        )}
                      </Stack>
                      <Divider sx={{ mb: 2 }} />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 4 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {lookupType === 'customer' ? 'Total Orders' : 'Total POs'}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {lookupType === 'customer' ? item.total_orders : item.total_pos}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            {lookupType === 'customer' ? 'Total Invoiced' : 'Total Billed'}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {lookupType === 'customer' ? item.total_invoiced_formatted : item.total_billed_formatted}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                            Outstanding Balance
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: 700,
                              color: Number(item.balance_due) > 0 ? 'error.main' : 'success.main',
                            }}
                          >
                            {item.balance_due_formatted}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* Recent Transactions list */}
                      {((lookupType === 'customer' && item.recent_invoices?.length > 0) ||
                        (lookupType === 'vendor' && item.recent_bills?.length > 0)) && (
                        <Box sx={{ mt: 2.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            RECENT TRANSACTIONS:
                          </Typography>
                          <Stack spacing={0.8} sx={{ mt: 0.5 }}>
                            {(lookupType === 'customer' ? item.recent_invoices : item.recent_bills).map((tx, idx) => (
                              <Box
                                key={idx}
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8rem',
                                  p: 0.8,
                                  bgcolor: 'action.hover',
                                  borderRadius: 1,
                                }}
                              >
                                <span><strong>{tx.invoice_number}</strong> ({tx.invoice_date})</span>
                                <span>Due: <strong>${Number(tx.balance_due).toLocaleString()}</strong></span>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
