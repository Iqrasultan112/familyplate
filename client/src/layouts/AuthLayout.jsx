import React from 'react';
import { Outlet } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import mealIllustration from '../assets/family-meal.svg';

export default function AuthLayout() {
  return (
    <main className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#F7FAF8] lg:grid lg:grid-cols-[minmax(360px,0.88fr)_minmax(520px,1.12fr)]">
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-[#EAF5EF] px-9 py-8 lg:flex xl:px-14">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(#B8DFD0 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -left-24 top-[28%] h-80 w-80 rounded-full bg-[#B8DFD0]/60 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3 text-primary-950">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-800 text-white shadow-sm"><UtensilsCrossed className="h-5 w-5" /></div>
          <span className="text-xl font-bold tracking-tight">FamilyPlate</span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-8">
          <div className="flex w-full max-w-[560px] items-center justify-center rounded-[2.5rem] border border-white/80 bg-white/55 p-3 shadow-[0_28px_70px_rgba(23,77,67,0.10)] backdrop-blur-sm">
            <img src={mealIllustration} alt="A freshly prepared family meal" className="max-h-[48vh] w-full object-contain" />
          </div>
          <div className="mt-9 w-full max-w-[560px]">
            <span className="inline-flex rounded-full border border-[#B8DFD0] bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-primary-700">Made for family kitchens</span>
            <h1 className="mt-4 max-w-lg text-4xl font-bold leading-[1.08] tracking-tight text-primary-950 xl:text-5xl">Good food starts with what you have.</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-primary-700">Plan everyday meals, keep family food needs in mind, and decide together.</p>
          </div>
        </div>

        <p className="relative z-10 text-sm font-medium text-primary-600">A little more joy around the family table.</p>
      </aside>

      <section className="flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-start px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-10 lg:justify-center lg:px-10 xl:px-16">
        <div className="mb-4 flex items-center gap-2.5 text-primary-950 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-800 text-white"><UtensilsCrossed className="h-5 w-5" /></div>
          <span className="text-xl font-bold tracking-tight">FamilyPlate</span>
        </div>
        <img src={mealIllustration} alt="A freshly prepared family meal" className="mb-3 h-14 w-auto object-contain sm:h-[76px] lg:hidden" />
        <div className="w-full max-w-[460px] rounded-3xl border border-[#DCE9E2] bg-white p-4 shadow-[0_20px_65px_rgba(23,77,67,0.08)] sm:p-7">
          <Outlet />
        </div>
        <p className="mt-5 text-center text-xs text-primary-500 lg:hidden">A little more joy around the family table.</p>
      </section>
    </main>
  );
}
