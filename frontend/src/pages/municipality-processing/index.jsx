import React, { useEffect, useState, useMemo } from 'react';
import { reportService } from '../../utils/report';
import api from '../../utils/api';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import PhotoUpload from '../citizen-reporting/components/PhotoUpload';
import { storeMedia } from '../../utils/mediaStorage';

const STATUS_OPTIONS = [
  { value: 'reported', label: 'Reported' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'action_ongoing', label: 'Action Ongoing' },
  { value: 'resolved', label: 'Resolved' }
];

export default function MunicipalityProcessing() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState('investigating');
  const [assignment, setAssignment] = useState({ name: '', phone: '', employeeId: '' });
  const [noteText, setNoteText] = useState('');
  const [resolutionPhotos, setResolutionPhotos] = useState([]);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await reportService.getAllReports();
      // Sort by newest first
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load reports for municipality page:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (report) => {
    setSelectedReport(report);
    setStatusUpdate(report.status || 'investigating');
    setAssignment({ name: '', phone: '', employeeId: '' });
    setNoteText('');
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;
    try {
      // If resolving, require employee-supplied evidence
      if (statusUpdate === 'resolved') {
        if (!resolutionPhotos || resolutionPhotos.length === 0) return alert('You must upload at least one image/video before marking resolved');
        // store media locally (storeMedia returns media IDs)
        const clientReportId = `resolution_${selectedReport.id}_${Date.now()}`;
        let mediaIds = [];
        try {
          mediaIds = await storeMedia(resolutionPhotos, clientReportId);
        } catch (e) {
          console.error('Failed to store resolution media locally:', e);
          return alert('Failed to store resolution media; please try again');
        }

        await api.post(`/reports/${selectedReport.id}/status`, { status: statusUpdate, resolutionMedia: mediaIds });
      } else {
        await api.post(`/reports/${selectedReport.id}/status`, { status: statusUpdate });
      }

      // update locally
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: statusUpdate } : r));
      setSelectedReport(prev => prev ? { ...prev, status: statusUpdate } : prev);
      // clear resolution photos after successful update
      setResolutionPhotos([]);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update status');
    }
  };

  const handleAssign = async () => {
    if (!selectedReport) return;
    if (!assignment.name || !assignment.employeeId) return alert('Name and employee ID required');
    try {
      await api.post(`/reports/${selectedReport.id}/assign`, {
        assigneeName: assignment.name,
        assigneePhone: assignment.phone,
        assigneeEmployeeId: assignment.employeeId
      });
      alert('Assignment saved');
    } catch (err) {
      console.error('Failed to assign report:', err);
      alert('Failed to assign report');
    }
  };

  const handleAddNote = async () => {
    if (!selectedReport) return;
    if (!noteText) return alert('Note is required');
    try {
      await api.post(`/reports/${selectedReport.id}/notes`, { note: noteText });
      alert('Note added');
      setNoteText('');
    } catch (err) {
      console.error('Failed to add note:', err);
      alert('Failed to add note');
    }
  };

  const visibleReports = useMemo(() => {
    // For municipality dashboard show all reports but hide reporter personal identifiers
    return reports;
  }, [reports]);

  return (
    <div style={{ marginTop: '4rem', height: 'calc(100vh - 64px)', overflow: 'hidden' }} className="p-4">
      <h1 className="text-2xl font-bold mb-3">Municipality Report Processing</h1>
      <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">

        {/* Section 1: Report Validation (list + preview) */}
        <div className="bg-card p-3 rounded-md flex flex-col min-h-0 border border-border" style={{ overflow: 'hidden' }}>
          <h2 className="font-semibold mb-2">Report Validation</h2>
          <div className="flex gap-3 h-full">
            <div className="w-1/2 overflow-auto border-r pr-2 min-h-0">
              {loading && <div>Loading...</div>}
              {!loading && visibleReports.length === 0 && <div className="text-sm text-muted-foreground">No reports available</div>}
              <ul className="space-y-2">
                {visibleReports.map(r => (
                  <li key={r.id} className={`p-2 rounded-md cursor-pointer ${selectedReport?.id === r.id ? 'bg-primary/10' : 'hover:bg-muted'}`} onClick={() => handleSelect(r)}>
                    <div className="text-sm font-medium">{r.issueType}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.timestamp * 1000).toLocaleString()}</div>
                    <div className="text-sm mt-1">{r.description?.slice(0, 120)}{r.description?.length > 120 ? '…' : ''}</div>
                    <div className="text-xs mt-1 text-muted-foreground">Status: {r.status || 'reported'}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-1/2 pl-2 overflow-auto min-h-0">
              {selectedReport ? (
                <div>
                  <h3 className="font-semibold">Preview</h3>
                  <div className="text-sm text-muted-foreground mb-2">(Reporter personal info is hidden for privacy)</div>
                  <div className="mb-2"><strong>Issue:</strong> {selectedReport.issueType}</div>
                  <div className="mb-2"><strong>Description:</strong><div className="whitespace-pre-wrap">{selectedReport.description}</div></div>
                  <div className="mb-2"><strong>Severity:</strong> {selectedReport.severity}</div>
                  <div className="mb-2"><strong>Location:</strong> {selectedReport.location?.display || ''}</div>
                  {selectedReport.photoHash ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Array.isArray(selectedReport.photoHash) ? selectedReport.photoHash.map((ph, i) => (
                        <div key={i} className="bg-muted h-24 flex items-center justify-center text-xs">Photo</div>
                      )) : <div className="bg-muted h-24 flex items-center justify-center text-xs">Photo</div>}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a report to preview</div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Report Status */}
        <div className="bg-card p-4 rounded-md flex flex-col min-h-0 border border-border" style={{ overflow: 'hidden' }}>
          <h2 className="font-semibold mb-2">Report Status</h2>
          <div className="flex-1 overflow-auto">
            {selectedReport ? (
              <div>
                <div className="mb-3"><strong>Selected Report:</strong> #{selectedReport.id} — {selectedReport.issueType}</div>
                <label className="block text-sm mb-1">Update status</label>
                <select className="w-full p-2 border rounded mb-3" value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Button onClick={handleUpdateStatus} className="mr-2">Save Status</Button>
                {statusUpdate === 'resolved' && (
                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground mb-2">Upload image/video evidence before resolving (required)</div>
                    <PhotoUpload photos={resolutionPhotos} onPhotosChange={setResolutionPhotos} />
                  </div>
                )}
                <div className="mt-4 text-sm text-muted-foreground">Current status: {selectedReport.status || 'reported'}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a report to change its status</div>
            )}
          </div>
        </div>

        {/* Section 3: Task Assignment */}
        <div className="bg-card p-4 rounded-md flex flex-col min-h-0 border border-border" style={{ overflow: 'hidden' }}>
          <h2 className="font-semibold mb-2">Task Assignment</h2>
          <div className="flex-1 overflow-auto">
            {selectedReport ? (
              <div>
                <div className="mb-2 text-sm">Assign someone to report <strong>#{selectedReport.id}</strong></div>
                <label className="block text-sm">Name</label>
                <input className="w-full p-2 border rounded mb-2" value={assignment.name} onChange={(e) => setAssignment({...assignment, name: e.target.value})} />
                <label className="block text-sm">Phone</label>
                <input className="w-full p-2 border rounded mb-2" value={assignment.phone} onChange={(e) => setAssignment({...assignment, phone: e.target.value})} />
                <label className="block text-sm">Employee ID</label>
                <input className="w-full p-2 border rounded mb-2" value={assignment.employeeId} onChange={(e) => setAssignment({...assignment, employeeId: e.target.value})} />
                <Button onClick={handleAssign}>Assign</Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Select a report to assign a task</div>
            )}
          </div>
        </div>

        {/* Section 4: Internal Notes / Extra */}
        <div className="bg-card p-4 rounded-md flex flex-col min-h-0 border border-border" style={{ overflow: 'hidden' }}>
          <h2 className="font-semibold mb-2">Internal Notes</h2>
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto mb-3">
              <div className="text-sm text-muted-foreground">Add private notes about the selected report. Notes are only visible to municipal staff.</div>
              <textarea className="w-full mt-2 p-2 border rounded h-40" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </div>
            <div>
              <Button onClick={handleAddNote} className="mr-2">Save Note</Button>
              <Button variant="ghost" onClick={() => { setNoteText(''); }}>Clear</Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
