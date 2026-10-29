import {fireEvent,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import AppearanceTab from '@/pages/settings/AppearanceTab';
import {renderWithProviders} from './test-utils';
import {PALETTE_KEY} from '@/lib/theme-palettes';
it('migrates a legacy palette and persists the selected mode without a server save',()=>{
 localStorage.setItem(PALETTE_KEY,'graphite-sage');localStorage.setItem('dark-mode','false');
 const view=renderWithProviders(<AppearanceTab />);
 expect(document.documentElement.dataset.palette).toBe('soulu');
 expect(document.documentElement.dataset.mode).toBe('light');
 expect(screen.queryByRole('radio',{name:'Graphite & Sage'})).toBeNull();
 fireEvent.click(screen.getByRole('radio',{name:'Dark'}));
 expect(localStorage.getItem(PALETTE_KEY)).toBe('soulu');
 expect(localStorage.getItem('dark-mode')).toBe('true');
 view.unmount();renderWithProviders(<AppearanceTab />);
 expect(document.documentElement.dataset.mode).toBe('dark');
 expect((screen.getByRole('radio',{name:'Dark'}) as HTMLInputElement).checked).toBe(true);
});
