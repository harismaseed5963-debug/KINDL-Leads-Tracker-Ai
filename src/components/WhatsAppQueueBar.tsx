import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  SkipForward,
  Pause,
  Play,
  Square,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Lead, UserProfile } from '../types';
import { buildWhatsAppUrl, personalizeWhatsAppMessage } from '../utils/whatsapp';
import { recordWhatsAppOutcome, setLeadWhatsAppLock } from '../services/leadsService';
import { logLeadActivity } from '../services/activityService';

interface WhatsAppQueueBarProps {
  queueIds: string[];
  leadsMap: Map<string, Lead>;
  currentUser: UserProfile;
  onCloseQueue: () => void;
  onToast: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const WhatsAppQueueBar: React.FC<WhatsAppQueueBarProps> = ({
  queueIds,
  leadsMap,
  currentUser,
  onCloseQueue,
  onToast,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoContacted, setAutoContacted] = useState(true);

  const currentLeadId = queueIds[currentIndex];
  const currentLead = currentLeadId ? leadsMap.get(currentLeadId) : undefined;
  const totalCount = queueIds.length;
  const remainingCount = Math.max(0, totalCount - currentIndex);

  // Set multi-user workflow lock on the active lead
  useEffect(() => {
    if (!currentLeadId || paused) return;
    setLeadWhatsAppLock(currentLeadId, currentUser);

    return () => {
      setLeadWhatsAppLock(currentLeadId, null);
    };
  }, [currentLeadId, paused, currentUser]);

  // Log workflow start once
  useEffect(() => {
    if (queueIds.length > 0) {
      logLeadActivity({
        leadId: queueIds.length === 1 ? queueIds[0] : 'WHATSAPP_QUEUE',
        leadName: `${queueIds.length} Leads`,
        action: 'WHATSAPP_WORKFLOW_STARTED',
        user: currentUser,
        details: `Started sequential WhatsApp outreach workflow for ${queueIds.length} lead${
          queueIds.length === 1 ? '' : 's'
        }`,
      });
    }
  }, []);

  if (queueIds.length === 0) return null;

  const isCompleted = currentIndex >= totalCount;

  const handleOpenWhatsApp = () => {
    if (!currentLead) return;
    const url = buildWhatsAppUrl(
      currentLead.phoneNormalized || currentLead.Phone_Number,
      currentLead.WhatsApp_Message,
      currentLead.Full_Name
    );
    if (!url) {
      onToast('Invalid phone number for WhatsApp link.', 'error');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOutcome = async (outcome: 'sent' | 'failed') => {
    if (!currentLead || busy) return;
    setBusy(true);
    try {
      await recordWhatsAppOutcome({
        lead: currentLead,
        outcome,
        markContactedOnSend: autoContacted,
        user: currentUser,
      });

      if (outcome === 'sent') {
        setSentCount((c) => c + 1);
      } else {
        setFailedCount((c) => c + 1);
      }

      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);

      // Automatically open WhatsApp for the next lead if user prefers rapid flow, or let them click
      if (nextIdx >= totalCount) {
        onToast(
          `WhatsApp workflow finished! Sent: ${
            outcome === 'sent' ? sentCount + 1 : sentCount
          }, Skipped/Failed: ${outcome === 'failed' ? failedCount + 1 : failedCount}`,
          'success'
        );
      }
    } catch {
      onToast('Failed to record WhatsApp status in Firestore.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    if (currentLeadId) {
      await setLeadWhatsAppLock(currentLeadId, null);
    }
    onCloseQueue();
  };

  const otherUserLock =
    currentLead &&
    currentLead.activeWorkflowBy &&
    currentLead.activeWorkflowBy !== currentUser.uid
      ? currentLead.activeWorkflowByName || 'another team member'
      : null;

  const personalizedPreview = currentLead
    ? personalizeWhatsAppMessage(
        currentLead.WhatsApp_Message || 'Assalam-o-Alaikum {name}, following up from KINDL.',
        currentLead.Full_Name
      )
    : '';

  return (
    <div className="bg-[#261C15] text-[#FFFDF9] border-2 border-[#D95D24] rounded-md p-4 mb-5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#6E5D50]/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#1E7E48] flex items-center justify-center text-white">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-tech text-xs uppercase tracking-wider font-semibold text-[#D95D24]">
                WhatsApp Outreach Queue {paused ? '(PAUSED)' : 'ACTIVE'}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono-tech bg-[#FFFDF9]/10 rounded">
                Progress: {Math.min(currentIndex + 1, totalCount)} / {totalCount}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono-tech bg-[#FFFDF9]/10 rounded">
                Remaining: {remainingCount}
              </span>
            </div>
            <p className="text-[11px] font-mono-tech text-[#DED4C3] mt-0.5">
              Sent: <strong className="text-emerald-400">{sentCount}</strong> • Failed/Skipped:{' '}
              <strong className="text-amber-400">{failedCount}</strong> • Manual Send Verification
              Required in WhatsApp
            </p>
          </div>
        </div>

        {/* Queue Controls: Pause / Resume / Stop */}
        <div className="flex items-center gap-2">
          <label className="hidden md:flex items-center gap-1.5 text-[11px] font-mono-tech text-[#DED4C3] mr-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoContacted}
              onChange={(e) => setAutoContacted(e.target.checked)}
              className="accent-[#D95D24]"
            />
            Auto-set &quot;New&quot; → &quot;Contacted&quot; on Sent
          </label>

          {!isCompleted && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="px-3 py-1.5 rounded bg-[#FFFDF9]/10 hover:bg-[#FFFDF9]/20 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {paused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  Pause
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleStop}
            className="px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-600 font-mono-tech text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            {isCompleted ? 'Close Runner' : 'Stop'}
          </button>
        </div>
      </div>

      {isCompleted ? (
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-serif-editorial text-lg font-bold">
                WhatsApp Queue Completed
              </h4>
              <p className="text-xs font-mono-tech text-[#DED4C3]">
                Processed {totalCount} leads • {sentCount} marked Sent • {failedCount} marked
                Failed/Skipped. All events saved to Activity History.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="px-4 py-2 bg-[#D95D24] hover:bg-[#B84A18] text-white font-mono-tech text-xs uppercase rounded cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : currentLead ? (
        <div className="pt-3.5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Current Lead Details */}
          <div className="lg:col-span-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-serif-editorial font-bold text-lg text-[#FFFDF9]">
                {currentLead.Full_Name}
              </span>
              <span className="px-2 py-0.5 text-[11px] font-mono-tech bg-[#D95D24] text-white rounded">
                {currentLead.Phone_Number}
              </span>
            </div>
            <p className="text-xs font-mono-tech text-[#DED4C3]">
              Status: {currentLead.Status} • Category: {currentLead.Lead_Category} • Program:{' '}
              {currentLead.Program || 'General'}
            </p>
            {otherUserLock && (
              <div className="mt-1.5 p-2 rounded bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-mono-tech flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Warning: Currently being handled by {otherUserLock}</span>
              </div>
            )}
          </div>

          {/* Personalized Message Preview */}
          <div className="lg:col-span-4 bg-[#FFFDF9]/5 border border-[#6E5D50]/50 rounded p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono-tech uppercase text-[#DED4C3] mb-1">
              <span>Pre-filled Message Preview (&#123;name&#125; personalized)</span>
            </div>
            <p className="text-xs font-sans-ui text-[#FFFDF9] line-clamp-2 whitespace-pre-wrap">
              {personalizedPreview}
            </p>
          </div>

          {/* Step Actions: 1. Open WhatsApp -> 2. Sent -> Next OR Failed -> Skip */}
          <div className="lg:col-span-4 flex flex-wrap items-center justify-end gap-2">
            <a
              href={buildWhatsAppUrl(
                currentLead.phoneNormalized || currentLead.Phone_Number,
                currentLead.WhatsApp_Message ||
                  'Assalam-o-Alaikum {name}, following up from KINDL.',
                currentLead.Full_Name
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (paused) {
                  e.preventDefault();
                  onToast('Resume the queue first before sending.', 'info');
                }
              }}
              className={`px-3.5 py-2 rounded bg-[#1E7E48] hover:bg-[#166338] text-white font-mono-tech text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                paused ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              1. Open WhatsApp
            </a>

            <button
              type="button"
              disabled={paused || busy}
              onClick={() => handleOutcome('sent')}
              className="px-3.5 py-2 rounded bg-[#D95D24] hover:bg-[#B84A18] disabled:opacity-50 text-white font-mono-tech text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              2. Sent → Next
            </button>

            <button
              type="button"
              disabled={paused || busy}
              onClick={() => handleOutcome('failed')}
              className="px-3 py-2 rounded bg-[#FFFDF9]/15 hover:bg-[#FFFDF9]/25 disabled:opacity-50 text-[#FFFDF9] font-mono-tech text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Failed → Skip
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
