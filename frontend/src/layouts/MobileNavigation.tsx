import { createContext, useContext } from 'react';

export const MobileNavigationContext = createContext({
  open: false,
  setOpen: (_open: boolean) => {},
});
export const useMobileNavigation = () => useContext(MobileNavigationContext);
