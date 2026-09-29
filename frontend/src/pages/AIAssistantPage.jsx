import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Button, Card, CardContent, Stack, Typography, Chip, Grid, TextField, InputAdornment, IconButton, Avatar, Paper,
  Tabs, Tab, CircularProgress, Alert, Tooltip, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Fade, LinearProgress
} from '@mui/material';

// Icons
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import SettingsIcon from '@mui/icons-material/Settings';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';

import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import aiService from '../services/aiService';
import { useCompany } from '../context/CompanyContext';
import { extractErrorMessage } from '../utils/errorUtils';

// ============================================================
// QUICK PROMPTS
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
];

// ============================================================
// LIGHTWEIGHT MARKDOWN / TABLE RENDERER COMPONENT
// ============================================================
function FormattedMessageContent({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  const elements = [];
  let tableLines = [];
  let inTable = false;

  const flushTable = (key) => {
    if (tableLines.length === 0) return;
    const headerLine = tableLines[0];
    const dataLines = tableLines.slice(2);
    const headers = headerLine.split('|').map((s) => s.trim()).filter(Boolean);
    elements.push(
      <TableContainer key={key} component={Paper} variant="outlined" sx={{ my: 1.5, borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: 'action.hover' }}>
            <TableRow>
              {headers.map((h, i) => (
                <TableCell key={i} sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{formatInlineText(h)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {dataLines.map((rowLine, rIdx) => {
              const cells = rowLine.split('|').map((s) => s.trim()).filter(Boolean);
              return (
                <TableRow key={rIdx} hover>
                  {cells.map((c, cIdx) => (
                    <TableCell key={cIdx} sx={{ fontSize: '0.8rem' }}>{formatInlineText(c)}</TableCell>
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
    const parts = [];
    let remaining = text;
    let idx = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
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
            <Box key={idx++} component="code" sx={{ backgroundColor: 'action.hover', px: 0.6, py: 0.2, borderRadius: 1, fontSize: '0.85em', fontFamily: 'monospace', color: 'primary.dark' }}>
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
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      tableLines.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable(`tbl-${i}`);
    }
    if (line.startsWith('### ')) {
      elements.push(<Typography key={`h3-${i}`} variant="subtitle1" sx={{ fontWeight: 700, mt: 1.5, mb: 0.5, color: 'primary.main' }}>{formatInlineText(line.replace('### ', ''))}</Typography>);
    } else if (line.startsWith('#### ')) {
      elements.push(<Typography key={`h4-${i}`} variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5, color: 'text.primary' }}>{formatInlineText(line.replace('#### ', ''))}</Typography>);
    } else if (line.trim().startsWith('- ')) {
      elements.push(
        <Box key={`li-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.4 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'primary.main', mt: 1, mr: 1.5, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{formatInlineText(line.trim().replace('- ', ''))}</Typography>
        </Box>
      );
    } else if (line.trim()) {
      elements.push(<Typography key={`p-${i}`} variant="body2" sx={{ my: 0.5, lineHeight: 1.6 }}>{formatInlineText(line)}</Typography>);
    }
  }
  if (inTable) flushTable(`tbl-end`);
  return <Box>{elements}</Box>;
}

// ============================================================
// MAIN AI ASSISTANT PAGE COMPONENT
// ============================================================
export default function AIAssistantPage() {
  const { activeCompany, loading: companyLoading } = useCompany();
  const [currentTab, setCurrentTab] = useState(0);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "👋 Hello! I am your ICORP AI Copilot. I can analyze sales orders, monitor inventory, check cash collections, track vendor spend, and report company profit.\n\nAsk me anything or select one of the suggested prompts below.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toolActivity, setToolActivity] = useState('');
  const messagesEndRef = useRef(null);

  // Settings State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState({
    provider: 'openai',
    model: 'gpt-4o',
    voiceOutput: true,
    autoSpeak: false,
    selectedVoice: null
  });

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  
  // Voice Synthesis
  const synth = window.speechSynthesis;
  const [voices, setVoices] = useState([]);

  // Executive Insights State
  const [insightsData, setInsightsData] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  // Entity Lookup State
  const [lookupType, setLookupType] = useState('customer');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSearched, setLookupSearched] = useState(false);

  // Setup Voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !aiSettings.selectedVoice) {
        setAiSettings(prev => ({ ...prev, selectedVoice: availableVoices[0].name }));
      }
    };
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }, [synth, aiSettings.selectedVoice]);

  // Setup Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputQuery(prev => prev + finalTranscript + ' ');
          setTranscript('');
        } else {
          setTranscript(interimTranscript);
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
        setTranscript('');
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        setTranscript('');
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInputQuery('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = (text) => {
    if (!aiSettings.voiceOutput) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (aiSettings.selectedVoice) {
      const voice = voices.find(v => v.name === aiSettings.selectedVoice);
      if (voice) utterance.voice = voice;
    }
    synth.speak(utterance);
  };

  const stopSpeaking = () => {
    synth.cancel();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentTab === 0) scrollToBottom();
  }, [messages, currentTab, isSending]);

  const loadExecutiveInsights = useCallback(async () => {
    if (!activeCompany?.id) return;
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      const data = await aiService.getInsights(activeCompany.id);
      setInsightsData(data);
    } catch (err) {
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

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isSending) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

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
    setToolActivity('Initializing Copilot Engine...');
    
    // Simulate Tool Activity
    const toolSteps = ['Analyzing intent...', 'Querying ERP modules...', 'Aggregating insights...', 'Generating response...'];
    let stepIndex = 0;
    const intervalId = setInterval(() => {
      if(stepIndex < toolSteps.length) {
        setToolActivity(toolSteps[stepIndex]);
        stepIndex++;
      }
    }, 800);

    try {
      const historyPayload = newMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await aiService.copilotChat(activeCompany?.id || null, query, historyPayload, aiSettings);

      clearInterval(intervalId);
      
      const aiResponseText = res.answer || res.text || res.content || res.message || "I found the data you requested.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: aiResponseText,
          files: res.files || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      
      if (aiSettings.autoSpeak) {
        speakText(aiResponseText);
      }
    } catch (err) {
      clearInterval(intervalId);
      console.error('AI chat failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ Error: ${extractErrorMessage(err) || "Could not retrieve data."}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      clearInterval(intervalId);
      setIsSending(false);
      setToolActivity('');
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'ai',
        text: "Conversation cleared. How can I help you today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    stopSpeaking();
  };

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
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  if (companyLoading) return <LoadingState message="Loading company context..." />;

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page Header */}
      <PageHeader
        title="AI Copilot"
        subtitle="Multimodal Operational Intelligence & Automation."
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button 
              variant="outlined" 
              color="inherit" 
              size="small" 
              startIcon={<SettingsIcon />} 
              onClick={() => setSettingsOpen(true)}
              sx={{ bgcolor: 'background.paper' }}
            >
              Copilot Settings
            </Button>
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

      {/* Settings Drawer */}
      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Box sx={{ width: 320, p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>Copilot Preferences</Typography>
          
          <FormControl fullWidth sx={{ mb: 3 }} size="small">
            <InputLabel>AI Provider</InputLabel>
            <Select 
              value={aiSettings.provider} 
              label="AI Provider"
              onChange={(e) => setAiSettings({...aiSettings, provider: e.target.value})}
            >
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="gemini">Google Gemini</MenuItem>
              <MenuItem value="groq">Groq (Llama 3)</MenuItem>
              <MenuItem value="mock">Local Offline Mock</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 3 }} size="small">
            <InputLabel>AI Model</InputLabel>
            <Select 
              value={aiSettings.model} 
              label="AI Model"
              onChange={(e) => setAiSettings({...aiSettings, model: e.target.value})}
            >
              <MenuItem value="gpt-4o">GPT-4o</MenuItem>
              <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
              <MenuItem value="gemini-1.5-pro">Gemini 1.5 Pro</MenuItem>
            </Select>
          </FormControl>
          
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}>Voice Settings</Typography>

          <FormControlLabel
            control={<Switch checked={aiSettings.voiceOutput} onChange={(e) => setAiSettings({...aiSettings, voiceOutput: e.target.checked})} />}
            label="Enable Voice Synthesis"
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            control={<Switch checked={aiSettings.autoSpeak} onChange={(e) => setAiSettings({...aiSettings, autoSpeak: e.target.checked})} disabled={!aiSettings.voiceOutput} />}
            label="Auto-speak responses"
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth size="small" disabled={!aiSettings.voiceOutput}>
            <InputLabel>Voice</InputLabel>
            <Select 
              value={aiSettings.selectedVoice || ''} 
              label="Voice"
              onChange={(e) => setAiSettings({...aiSettings, selectedVoice: e.target.value})}
            >
              {voices.map(v => (
                <MenuItem key={v.name} value={v.name}>{v.name} ({v.lang})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Drawer>

      {/* Navigation Tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} indicatorColor="primary" textColor="primary" sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab icon={<AutoAwesomeIcon />} iconPosition="start" label="Copilot Chat" />
          <Tab icon={<AccountBalanceWalletOutlinedIcon />} iconPosition="start" label="Executive Digest" />
          <Tab icon={<PeopleAltOutlinedIcon />} iconPosition="start" label="Entity Lookup" />
        </Tabs>
      </Paper>

      {/* ============================================================
          TAB 0: COPILOT CHAT
          ============================================================ */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2.5, display: 'flex', flexDirection: 'column', height: '75vh' }}>
              
              {/* Chat Header */}
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'primary.main', color: 'white' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 20 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      ICORP AI Copilot
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      Model: {aiSettings.model} | Provider: {aiSettings.provider.toUpperCase()}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Stop Speaking">
                    <IconButton size="small" onClick={stopSpeaking} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      <VolumeOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Clear Chat">
                    <IconButton size="small" onClick={handleClearChat} sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      <DeleteSweepOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>

              {/* Chat Messages Body */}
              <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                <Stack spacing={3}>
                  {messages.map((msg) => (
                    <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      <Stack direction="row" spacing={1.5} sx={{ maxWidth: { xs: '95%', md: '80%' }, flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: msg.sender === 'user' ? 'secondary.main' : 'primary.main', flexShrink: 0 }}>
                          {msg.sender === 'user' ? <PersonOutlinedIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
                        </Avatar>

                        <Paper elevation={1} sx={{ p: 2, borderRadius: 3, borderTopRightRadius: msg.sender === 'user' ? 4 : 24, borderTopLeftRadius: msg.sender === 'ai' ? 4 : 24, backgroundColor: msg.sender === 'user' ? 'secondary.main' : '#ffffff', color: msg.sender === 'user' ? '#ffffff' : 'text.primary', border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0' }}>
                          {msg.sender === 'user' ? (
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>{msg.text}</Typography>
                          ) : (
                            <FormattedMessageContent content={msg.text} />
                          )}
                          
                          {/* File Cards */}
                          {msg.files && msg.files.length > 0 && (
                            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                              {msg.files.map((file, idx) => (
                                <Card key={idx} variant="outlined" sx={{ width: 220, bgcolor: 'action.hover' }}>
                                  <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <InsertDriveFileIcon color="primary" />
                                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                      <Typography variant="subtitle2" noWrap>{file.name}</Typography>
                                      <Typography variant="caption" color="text.secondary">{file.size}</Typography>
                                    </Box>
                                    <IconButton size="small" component="a" href={file.url} download>
                                      <DownloadIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Card>
                              ))}
                            </Stack>
                          )}

                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'text.disabled' }}>
                              {msg.timestamp}
                            </Typography>
                            {msg.sender === 'ai' && (
                              <>
                                <Tooltip title="Read Aloud">
                                  <IconButton size="small" onClick={() => speakText(msg.text)} sx={{ p: 0.2, color: 'text.secondary' }}>
                                    <VolumeUpIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Copy Text">
                                  <IconButton size="small" onClick={() => navigator.clipboard.writeText(msg.text)} sx={{ p: 0.2, color: 'text.secondary' }}>
                                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </Paper>
                      </Stack>
                    </Box>
                  ))}

                  {/* Typing / Tool Indicator */}
                  {isSending && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                        <AutoAwesomeIcon fontSize="small" />
                      </Avatar>
                      <Paper variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 200 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <CircularProgress size={16} />
                          <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {toolActivity}
                          </Typography>
                        </Stack>
                        <LinearProgress sx={{ height: 2, borderRadius: 1 }} />
                      </Paper>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </Stack>
              </Box>
              
              {/* Voice Transcription Indicator */}
              <Fade in={isListening || !!transcript}>
                <Box sx={{ px: 3, py: 1, bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GraphicEqIcon color="error" sx={{ animation: 'pulse 1s infinite' }} />
                  <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>
                    Listening... {transcript}
                  </Typography>
                </Box>
              </Fade>

              {/* Chat Input Bar */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: '#ffffff' }}>
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Tooltip title={isListening ? "Stop Listening" : "Voice Input"}>
                      <IconButton 
                        color={isListening ? "error" : "default"} 
                        onClick={toggleListening}
                        sx={{ bgcolor: isListening ? 'error.light' : 'action.hover', color: isListening ? 'white' : 'inherit', '&:hover': { bgcolor: isListening ? 'error.main' : 'action.selected' } }}
                      >
                        {isListening ? <MicOffIcon /> : <MicIcon />}
                      </IconButton>
                    </Tooltip>
                    
                    <TextField
                      fullWidth
                      size="medium"
                      placeholder="Ask the Copilot to analyze sales, draft reports, or look up records..."
                      value={inputQuery}
                      onChange={(e) => setInputQuery(e.target.value)}
                      disabled={isSending}
                      autoComplete="off"
                      multiline
                      maxRows={3}
                      InputProps={{
                        sx: { borderRadius: 3, bgcolor: 'action.hover' }
                      }}
                    />
                    
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={(!inputQuery.trim() && !isListening) || isSending}
                      sx={{ borderRadius: 3, px: 3, py: 1.5, minWidth: 100, textTransform: 'none', fontWeight: 600, boxShadow: 2 }}
                    >
                      {isSending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                    </Button>
                  </Stack>
                  <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>Suggestions:</Typography>
                    {QUICK_PROMPTS.slice(0, 4).map((p) => (
                      <Chip key={p.label} label={p.label} size="small" onClick={() => handleSendMessage(p.label)} variant="outlined" clickable sx={{ fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </form>
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ============================================================
          TAB 1: EXECUTIVE ERP DIGEST (Preserved)
          ============================================================ */}
      {currentTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Real-Time Operational Digest</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Consolidated operational telemetry across modules.</Typography>
            </Box>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadExecutiveInsights} disabled={insightsLoading} size="small" sx={{ borderRadius: 2 }}>Refresh Data</Button>
          </Box>
          {insightsLoading ? <LoadingState message="Generating digest..." /> : insightsError ? <Alert severity="error">{insightsError}</Alert> : insightsData ? (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}><StatCard title="Month Sales" value={insightsData.sales?.month_sales_formatted || '$0.00'} subtitle={`${insightsData.sales?.month_invoice_count || 0} invoices`} icon={PointOfSaleOutlinedIcon} color="primary" /></Grid>
              <Grid item xs={12} sm={6} md={3}><StatCard title="Total Purchases" value={insightsData.purchases?.total_purchases_formatted || '$0.00'} subtitle={`Unpaid: ${insightsData.purchases?.unpaid_bills_formatted || '$0.00'}`} icon={ShoppingCartOutlinedIcon} color="warning" /></Grid>
              <Grid item xs={12} sm={6} md={3}><StatCard title="Current Net Profit" value={insightsData.finance?.net_profit_formatted || '$0.00'} subtitle={`Gross: ${insightsData.finance?.gross_profit_formatted || '$0.00'}`} icon={AccountBalanceWalletOutlinedIcon} color="success" /></Grid>
              <Grid item xs={12} sm={6} md={3}><StatCard title="Liquid Funds" value={insightsData.finance?.liquid_funds_formatted || '$0.00'} subtitle={`Receivables: ${insightsData.finance?.receivables_formatted || '$0.00'}`} icon={BusinessOutlinedIcon} color="info" /></Grid>
            </Grid>
          ) : null}
        </Box>
      )}

      {/* ============================================================
          TAB 2: CUSTOMER & VENDOR INTELLIGENCE LOOKUP (Preserved)
          ============================================================ */}
      {currentTab === 2 && (
        <Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Entity Intelligence Hub</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Quick profile lookup.</Typography>
          </Box>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, mb: 3 }}>
            <form onSubmit={handleEntitySearch}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <Stack direction="row" spacing={1}>
                    <Button fullWidth variant={lookupType === 'customer' ? 'contained' : 'outlined'} onClick={() => { setLookupType('customer'); setLookupResults([]); setLookupSearched(false); }}>Customer</Button>
                    <Button fullWidth variant={lookupType === 'vendor' ? 'contained' : 'outlined'} onClick={() => { setLookupType('vendor'); setLookupResults([]); setLookupSearched(false); }}>Vendor</Button>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={7}>
                  <TextField fullWidth size="small" placeholder={`Search ${lookupType}...`} value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button fullWidth type="submit" variant="contained" disabled={!lookupQuery.trim() || lookupLoading}>Lookup</Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
          {lookupLoading ? <LoadingState message="Searching..." /> : lookupSearched && lookupResults.length === 0 ? <EmptyState title="No Results" description="Try a different query." /> : (
            <Grid container spacing={2.5}>
              {lookupResults.map((item) => (
                <Grid item xs={12} md={6} key={item.id}>
                  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.email} • {item.phone}</Typography>
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
