import React, { useEffect, useState, useCallback } from 'react';
import { entryApi, holidayApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { TeamMemberData, Holiday, StatusType, EntryDetail } from '../types';
import {
  getCurrentMonth,
  offsetMonth,
  formatMonth,
  getDaysInMonth,
  isWeekend,
  isPast,
  isToday,
  getDayNumber,
  getShortDayName,
  canMemberEdit,
} from '../utils/date';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, { bg: string; label: string; emoji: string }> = {
  office: { bg: 'bg-blue-100 text-blue-800', label: 'Office', emoji: '🏢' },
  leave: { bg: 'bg-orange-100 text-orange-800', label: 'Leave', emoji: '🌴' },
  wfh: { bg: 'bg-green-50 text-green-600', label: 'WFH', emoji: '🏠' },
  holiday: { bg: 'bg-purple-100 text-purple-700', label: 'Holiday', emoji: '🎉' },
  weekend: { bg: 'bg-gray-100 text-gray-400', label: '', emoji: '' },
};

interface EditCellState {
  userId: string;
  date: string;
  // form fields for the popover
  status: StatusType | 'wfh';
  note: string;
  startTime: string;
  endTime: string;
}

const TeamCalendarPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth);
  const [team, setTeam] = useState<TeamMemberData[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<EditCellState | null>(null);
  const [saving, setSaving] = useState(false);

  const days = getDaysInMonth(month);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, holidayRes] = await Promise.all([
        entryApi.getTeamEntries(month),
        holidayApi.getHolidays(days[0], days[days.length - 1]),
      ]);
      setTeam(teamRes.data.data?.team || []);

      const hMap: Record<string, string> = {};
      (holidayRes.data.data || []).forEach((h: Holiday) => {
        hMap[h.date] = h.name;
      });
      setHolidays(hMap);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getEffectiveStatus = (
    memberEntries: Record<string, EntryDetail>,
    date: string
  ): string => {
    if (isWeekend(date)) return 'weekend';
    if (holidays[date]) return 'holiday';
    return memberEntries[date]?.status || 'wfh';
  };

  const handleCellClick = (memberId: string, date: string, memberEntries: Record<string, EntryDetail>) => {
    if (isWeekend(date) || holidays[date]) return;

    const isSelf = memberId === user?._id;
    if (!isSelf && !isAdmin) return;
    if (!isAdmin && !canMemberEdit(date)) return;

    const existing = memberEntries[date];
    setEditCell({
      userId: memberId,
      date,
      status: existing?.status || 'wfh',
      note: existing?.note || '',
      startTime: existing?.startTime || '',
      endTime: existing?.endTime || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editCell) return;
    const { userId, date, status, note, startTime, endTime } = editCell;

    // Validate time
    if ((startTime && !endTime) || (!startTime && endTime)) {
      toast.error('Provide both start and end time, or leave both empty');
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      toast.error('End time must be after start time');
      return;
    }

    setSaving(true);
    try {
      const isSelf = userId === user?._id;
      const opts = {
        note: note || '',
        startTime: startTime || '',
        endTime: endTime || '',
      };

      if (status === 'wfh') {
        if (isAdmin && !isSelf) {
          await entryApi.adminDeleteEntry(userId, date);
        } else {
          await entryApi.deleteEntry(date);
        }
      } else {
        if (isAdmin && !isSelf) {
          await entryApi.adminUpsertEntry(userId, date, status, opts);
        } else {
          await entryApi.upsertEntry(date, status, opts);
        }
      }

      // Update local state
      setTeam((prev) =>
        prev.map((m) => {
          if (m.user._id !== userId) return m;
          const newEntries = { ...m.entries };
          if (status === 'wfh') {
            delete newEntries[date];
          } else {
            newEntries[date] = {
              status,
              ...(note ? { note } : {}),
              ...(startTime ? { startTime } : {}),
              ...(endTime ? { endTime } : {}),
            };
          }
          return { ...m, entries: newEntries };
        })
      );
      setEditCell(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  /** Build tooltip text for a cell. */
  const buildTooltip = (entry: EntryDetail | undefined, date: string): string => {
    if (holidays[date]) return `🎉 ${holidays[date]}`;
    if (!entry) return 'WFH';
    const parts = [STATUS_STYLES[entry.status]?.label || entry.status];
    if (entry.startTime && entry.endTime) parts.push(`⏰ ${entry.startTime}–${entry.endTime}`);
    if (entry.note) parts.push(`📝 ${entry.note}`);
    return parts.join(' · ');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Calendar</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonth(offsetMonth(month, -1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ◀
          </button>
          <span className="text-lg font-semibold min-w-[180px] text-center">
            {formatMonth(month)}
          </span>
          <button
            onClick={() => setMonth(offsetMonth(month, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ▶
          </button>
          <button
            onClick={() => setMonth(getCurrentMonth())}
            className="ml-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        {Object.entries(STATUS_STYLES)
          .filter(([key]) => key !== 'weekend')
          .map(([key, val]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded ${val.bg}`} />
              {val.emoji} {val.label}
            </span>
          ))}
        <span className="flex items-center gap-1 text-gray-400">
          ⏰ = active hours · 📝 = note
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-semibold text-gray-700 min-w-[140px] border-r border-gray-200">
                  Team Member
                </th>
                {days.map((date) => {
                  const weekend = isWeekend(date);
                  const today = isToday(date);
                  return (
                    <th
                      key={date}
                      className={`px-1 py-2 text-center min-w-[36px] ${
                        weekend ? 'bg-gray-100 text-gray-400' : ''
                      } ${today ? 'bg-primary-50' : ''}`}
                    >
                      <div className="text-[10px] text-gray-500">
                        {getShortDayName(date)}
                      </div>
                      <div className={`text-xs font-semibold ${today ? 'text-primary-600' : ''}`}>
                        {getDayNumber(date)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {team.map((member) => {
                const isSelf = member.user._id === user?._id;
                return (
                  <tr
                    key={member.user._id}
                    className={`border-t border-gray-100 ${
                      isSelf ? 'bg-primary-50/30' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="sticky left-0 bg-white z-10 px-3 py-2 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap">
                      {member.user.name}
                      {isSelf && (
                        <span className="ml-1 text-[10px] text-primary-500">(You)</span>
                      )}
                    </td>
                    {days.map((date) => {
                      const status = getEffectiveStatus(member.entries, date);
                      const style = STATUS_STYLES[status];
                      const weekend = isWeekend(date);
                      const today = isToday(date);
                      const past = isPast(date);
                      const canEdit =
                        !weekend &&
                        !holidays[date] &&
                        (isAdmin || (isSelf && canMemberEdit(date)));

                      const isEditing =
                        editCell?.userId === member.user._id &&
                        editCell?.date === date;

                      const entry = member.entries[date];
                      const hasTime = entry?.startTime && entry?.endTime;
                      const hasNote = !!entry?.note;

                      return (
                        <td
                          key={date}
                          className={`relative px-0.5 py-1 text-center ${
                            weekend ? 'bg-gray-100' : ''
                          } ${today ? 'bg-primary-50/60' : ''} ${
                            past && !isAdmin ? 'opacity-60' : ''
                          } ${canEdit ? 'cursor-pointer' : ''}`}
                          onClick={() => canEdit && handleCellClick(member.user._id, date, member.entries)}
                          title={buildTooltip(entry, date)}
                        >
                          {!weekend && (
                            <div className="relative inline-block">
                              <span
                                className={`inline-block w-7 h-7 leading-7 rounded-md text-xs font-medium ${style.bg}`}
                              >
                                {status === 'holiday'
                                  ? '🎉'
                                  : status === 'office'
                                  ? '🏢'
                                  : status === 'leave'
                                  ? '🌴'
                                  : '·'}
                              </span>
                              {/* Indicators for time / note */}
                              {(hasTime || hasNote) && (
                                <span className="absolute -top-1 -right-1 flex gap-px">
                                  {hasTime && <span className="text-[7px]">⏰</span>}
                                  {hasNote && <span className="text-[7px]">📝</span>}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Inline edit popover */}
                          {isEditing && (
                            <div
                              className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex flex-col gap-2 min-w-[260px] text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Status buttons */}
                              <div className="flex gap-1">
                                {([
                                  { value: 'office' as const, label: '🏢 Office', hover: 'hover:bg-blue-50' },
                                  { value: 'leave' as const, label: '🌴 Leave', hover: 'hover:bg-orange-50' },
                                  { value: 'wfh' as const, label: '🏠 WFH', hover: 'hover:bg-green-50' },
                                ] as const).map((opt) => (
                                  <button
                                    key={opt.value}
                                    className={`flex-1 px-2 py-1 text-xs rounded border transition-all ${
                                      editCell.status === opt.value
                                        ? 'bg-gray-100 border-gray-300 font-semibold'
                                        : `border-gray-200 ${opt.hover}`
                                    }`}
                                    onClick={() => setEditCell({ ...editCell, status: opt.value })}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>

                              {/* Time inputs */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-500 w-6">⏰</span>
                                <input
                                  type="time"
                                  value={editCell.startTime}
                                  onChange={(e) => setEditCell({ ...editCell, startTime: e.target.value })}
                                  className="flex-1 px-1.5 py-1 border border-gray-200 rounded text-xs"
                                />
                                <span className="text-[10px] text-gray-400">–</span>
                                <input
                                  type="time"
                                  value={editCell.endTime}
                                  onChange={(e) => setEditCell({ ...editCell, endTime: e.target.value })}
                                  className="flex-1 px-1.5 py-1 border border-gray-200 rounded text-xs"
                                />
                                {(editCell.startTime || editCell.endTime) && (
                                  <button
                                    className="text-[10px] text-red-400 hover:text-red-600"
                                    onClick={() => setEditCell({ ...editCell, startTime: '', endTime: '' })}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Note */}
                              <textarea
                                value={editCell.note}
                                onChange={(e) =>
                                  setEditCell({ ...editCell, note: e.target.value.slice(0, 500) })
                                }
                                rows={2}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs resize-none"
                                placeholder="Note (optional, max 500)"
                              />

                              {/* Actions */}
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-400">
                                  {editCell.note.length}/500
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    className="px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 rounded"
                                    onClick={() => setEditCell(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                  >
                                    {saving ? '…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <div className="mt-4 text-xs text-gray-500">
          Showing {team.length} team members · {days.length} days ·
          Click a cell to change status, set hours &amp; add notes
        </div>
      )}
    </div>
  );
};

export default TeamCalendarPage;
