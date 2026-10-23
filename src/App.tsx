import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { QueuePage } from './pages/QueuePage';
import { AllLeadsPage } from './pages/AllLeadsPage';
import { NewLeadPage } from './pages/NewLeadPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { useToast } from './lib/toast';
import { Lead } from './lib/types';

export function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast, updateToast } = useToast();

  const bumpRefresh = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  // Section 10: Load 8 sample leads and analyze them in parallel batches of 3 with progress toast
  const handleLoadSamples = useCallback(async () => {
    if (loadingSamples) return;
    setLoadingSamples(true);
    const toastId = showToast('Creating 8 sample leads...', 'loading', 0);

    try {
      const res = await fetch('/api/sample-leads', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create sample leads');

      const sampleLeads: Lead[] = data.leads || [];
      const pendingLeads = sampleLeads.filter((l) => l.analysis_status !== 'done');

      if (pendingLeads.length === 0) {
        updateToast(toastId, 'Sample leads are already loaded in your workspace.', 'info');
        bumpRefresh();
        return;
      }

      const total = pendingLeads.length;
      let completed = 0;

      // Process in parallel batches of 3
      const BATCH_SIZE = 3;
      for (let i = 0; i < pendingLeads.length; i += BATCH_SIZE) {
        const batch = pendingLeads.slice(i, i + BATCH_SIZE);
        updateToast(
          toastId,
          `Analyzing ${Math.min(completed + batch.length, total)} of ${total} sample leads...`,
          'loading'
        );

        await Promise.all(
          batch.map(async (lead) => {
            try {
              await fetch(`/api/leads/${lead.id}/analyze`, { method: 'POST' });
            } catch {
              // Individual failure keeps lead saved as 'failed' with Retry button
            } finally {
              completed++;
            }
          })
        );
        bumpRefresh();
      }

      updateToast(toastId, 'All 8 sample leads analyzed and added to your queue!', 'success');
      bumpRefresh();
      if (location.pathname === '/new') {
        navigate('/queue');
      }
    } catch (err: any) {
      updateToast(toastId, err.message || 'Failed to load sample leads', 'error');
    } finally {
      setLoadingSamples(false);
    }
  }, [loadingSamples, showToast, updateToast, bumpRefresh, location.pathname, navigate]);

  const getPageTitle = () => {
    if (location.pathname.startsWith('/queue')) return "Today's Queue";
    if (location.pathname === '/leads') return 'All Leads';
    if (location.pathname === '/new') return 'New Lead';
    if (location.pathname.startsWith('/leads/')) return 'Lead Workspace';
    return 'LeadLens';
  };

  return (
    <Layout
      title={getPageTitle()}
      onDataChanged={bumpRefresh}
      loadingSamples={loadingSamples}
      onTriggerLoadSamples={handleLoadSamples}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/queue" replace />} />
        <Route
          path="/queue"
          element={
            <QueuePage
              refreshTrigger={refreshTrigger}
              loadingSamples={loadingSamples}
              onLoadSamples={handleLoadSamples}
            />
          }
        />
        <Route
          path="/leads"
          element={
            <AllLeadsPage
              refreshTrigger={refreshTrigger}
              loadingSamples={loadingSamples}
              onLoadSamples={handleLoadSamples}
            />
          }
        />
        <Route path="/new" element={<NewLeadPage onLeadCreated={bumpRefresh} />} />
        <Route path="/leads/:id" element={<LeadDetailPage onLeadUpdated={bumpRefresh} />} />
        <Route path="*" element={<Navigate to="/queue" replace />} />
      </Routes>
    </Layout>
  );
}