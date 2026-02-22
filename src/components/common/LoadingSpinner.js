import React from 'react';

const LoadingSpinner = () => (
    <div className="min-h-screen relative bg-slate-50">
        <div className="p-4 space-y-6 max-w-7xl mx-auto pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="h-32 w-full bg-slate-200 rounded-[2rem] animate-pulse"></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
                <div className="h-40 bg-slate-200 rounded-[2rem] animate-pulse"></div>
            </div>
        </div>
    </div>
);

export default LoadingSpinner;
