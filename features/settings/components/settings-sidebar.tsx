"use client";

import {
  Icon,
  modalSettingsNavItems,
  type ModalSettingsSection
} from "@/features/settings/components/settings-shared";

export function SettingsSidebar({
  activeSection,
  onSectionChange
}: {
  activeSection: ModalSettingsSection;
  onSectionChange: (section: ModalSettingsSection) => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col border-r border-white/10 bg-[#061126] text-white lg:flex">
      <div className="shrink-0 border-b border-white/10 px-5 py-4">
        <h3 className="text-sm font-black">Settings</h3>
      </div>

      <nav
        aria-label="Settings sections"
        className="min-h-0 flex-1 space-y-1 overflow-hidden px-3 py-3"
      >
        {modalSettingsNavItems.map((item) => (
          <button
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition ${
              item.label === activeSection
                ? "bg-white/10 text-white"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
            key={item.label}
            onClick={() => onSectionChange(item.label)}
            title={item.description}
            type="button"
          >
            <Icon className="h-4 w-4 shrink-0" name={item.icon} />
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
