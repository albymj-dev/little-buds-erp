import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTypography } from '../contexts/TypographyContext';
import { LayoutDashboard, Users, CreditCard, CalendarCheck, LogOut, Menu, X, BarChart2, Activity, Palette, KeyRound } from 'lucide-react';
import { LittleBudsBrandHeader, LittleBudsLogo } from './Logo';
import { TypographyCustomizerModal } from './TypographyCustomizerModal';
import { AccountSettingsModal } from './AccountSettingsModal';
import { StyledWordText } from './StyledWordText';

const Layout = () => {
  const { currentUser, logout, isAccountModalOpen, setIsAccountModalOpen } = useAuth();
  const {
    accentColor,
    secondaryAccentColor,
    elementFontSizes,
    brandTitleWords,
    brandSubtitleWords,
    setIsCustomizerOpen,
  } = useTypography();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Students', href: '/students', icon: Users },
    { name: 'Attendance', href: '/attendance', icon: CalendarCheck },
    { name: 'Fees & Dues', href: '/fees', icon: CreditCard },
    { name: 'Reports & Finances', href: '/reports', icon: BarChart2 },
    { name: 'Activity Log', href: '/activity', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-stone-900/60 backdrop-blur-xs md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-stone-200/80 transform transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 shrink-0 items-center justify-between px-4 border-b border-stone-100 bg-linear-to-b from-stone-50/50 to-white">
          <LittleBudsBrandHeader size="md" />
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              title="Customize Typography & Colors"
            >
              <Palette className="h-4 w-4" style={{ color: accentColor }} />
            </button>
            <button className="md:hidden text-stone-400 hover:text-stone-600" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4">
          <nav className="flex-1 space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2.5 font-semibold rounded-xl transition-all duration-150 ${
                    isActive
                      ? 'shadow-xs border'
                      : 'text-stone-600 hover:bg-stone-100/70 hover:text-stone-900'
                  }`}
                  style={{
                    fontSize: `${elementFontSizes.navText}px`,
                    ...(isActive
                      ? {
                          backgroundColor: `${accentColor}15`,
                          color: accentColor,
                          borderColor: `${accentColor}35`,
                        }
                      : {}),
                  }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 shrink-0 transition-colors ${
                      isActive ? '' : 'text-stone-400 group-hover:text-stone-600'
                    }`}
                    style={isActive ? { color: accentColor } : undefined}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <span
                      className="ml-auto w-1.5 h-4 rounded-full"
                      style={{ backgroundColor: secondaryAccentColor }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Typography & Styling Trigger Button */}
          <div className="pt-3 mt-3 border-t border-stone-200/70">
            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="w-full group flex items-center justify-between px-3 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-all shadow-2xs font-bold"
              style={{ fontSize: `${elementFontSizes.navText}px` }}
            >
              <div className="flex items-center">
                <Palette
                  className="mr-2.5 h-4 w-4 transition-transform group-hover:scale-110"
                  style={{ color: accentColor }}
                />
                <span>Style & Colours</span>
              </div>
              <span
                className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full text-white shadow-2xs"
                style={{ backgroundColor: secondaryAccentColor }}
              >
                Customize
              </span>
            </button>
          </div>
        </div>

        <div className="border-t border-stone-200/70 p-3 bg-stone-50/50">
          <div className="flex items-center w-full justify-between">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center space-x-2.5 min-w-0 flex-1 text-left p-1.5 rounded-xl hover:bg-stone-200/50 transition-colors group cursor-pointer"
              title="Click to edit profile, username, or password"
            >
              <div
                className="h-8 w-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {currentUser?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-stone-900 truncate group-hover:text-[#558B2F] transition-colors">
                  {currentUser?.name}
                </p>
                <p className="text-[11px] font-medium text-stone-500 capitalize truncate flex items-center">
                  <span>@{currentUser?.username || 'admin'}</span>
                  <span className="mx-1">•</span>
                  <span>{currentUser?.role}</span>
                </p>
              </div>
            </button>
            <div className="flex items-center space-x-1 shrink-0 ml-1">
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-white rounded-lg border border-transparent hover:border-stone-200 transition-colors"
                title="Account & Password Settings"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                title="Logout"
              >
                <span className="sr-only">Logout</span>
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 bg-white border-b border-stone-200 md:hidden items-center justify-between px-3">
          <button
            type="button"
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex items-center space-x-2">
            <LittleBudsLogo className="h-8 w-8" />
            <div className="flex flex-col">
              <StyledWordText
                words={brandTitleWords}
                fontSize={elementFontSizes.brandTitle}
                className="font-extrabold text-stone-900 leading-tight"
              />
              <StyledWordText
                words={brandSubtitleWords}
                fontSize={elementFontSizes.brandSubtitle}
                className="font-semibold uppercase tracking-wide leading-none mt-0.5"
              />
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              title="Account & Password Settings"
            >
              <KeyRound className="h-4 w-4 text-stone-600" />
            </button>
            <button
              type="button"
              onClick={() => setIsCustomizerOpen(true)}
              className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg"
              title="Customize Typography & Colors"
            >
              <Palette className="h-5 w-5" style={{ color: accentColor }} />
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto outline-none focus:outline-none relative bg-stone-50">
          <Outlet />
        </main>
      </div>

      {/* Global Modals */}
      <TypographyCustomizerModal />
      <AccountSettingsModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
