import React, { useEffect, useState } from 'react';
import { holidayApi } from '../api';
import type { Holiday } from '../types';
import toast from 'react-hot-toast';

const AdminHolidaysPage: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await holidayApi.getHolidays();
      setHolidays(res.data.data || []);
    } catch {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const openCreate = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
    setShowForm(true);
  };

  const openEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormDate(h.date);
    setFormName(h.name);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await holidayApi.updateHoliday(editingHoliday._id, formDate, formName);
        toast.success('Holiday updated');
      } else {
        await holidayApi.createHoliday(formDate, formName);
        toast.success('Holiday created');
      }
      setShowForm(false);
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save holiday');
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!window.confirm(`Delete holiday "${h.name}" on ${h.date}?`)) return;
    try {
      await holidayApi.deleteHoliday(h._id);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete holiday');
    }
  };

  const formatDisplayDate = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Holidays</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Holiday
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No holidays configured. Click "Add Holiday" to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h._id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{formatDisplayDate(h.date)}</td>
                  <td className="px-4 py-3 font-medium">🎉 {h.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(h)}
                      className="text-xs px-2 py-1 text-primary-600 hover:bg-primary-50 rounded mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(h)}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Holiday name"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
                >
                  {editingHoliday ? 'Save Changes' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHolidaysPage;
