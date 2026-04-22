'use client';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#F56C49]/10 border border-[#F56C49]/20 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F56C49" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Under Maintenance</h1>
        <p className="text-[#94A3B8] text-sm leading-relaxed mb-6">
          We're upgrading sqilled Options with new features. We'll be back shortly.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F56C49]/10 border border-[#F56C49]/20">
          <span className="w-2 h-2 rounded-full bg-[#F56C49] animate-pulse" />
          <span className="text-[#F56C49] text-xs font-medium">Back soon</span>
        </div>
      </div>
    </div>
  );
}
