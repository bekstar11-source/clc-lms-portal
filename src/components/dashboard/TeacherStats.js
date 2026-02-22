import React from 'react';

const TeacherStats = ({ groupsCount, debtorsCount }) => {
    return (
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-xl shadow-indigo-500/10 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Guruhlar</p>
                <h2 className="text-3xl font-black text-indigo-600">{groupsCount}</h2>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-xl shadow-indigo-500/10 flex flex-col items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qarzdorlar</p>
                <h2 className="text-3xl font-black text-red-500">{debtorsCount}</h2>
            </div>
        </div>
    );
};

export default TeacherStats;
