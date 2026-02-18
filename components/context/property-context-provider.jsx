"use client";

import { createContext, useContext } from "react";

const PropertiesContext = createContext(null);

export function PropertiesProvider({ children, properties }) {
  return (
    <PropertiesContext.Provider value={{ properties }}>
      {children}
    </PropertiesContext.Provider>
  );
}

export function useProperties() {
  return useContext(PropertiesContext);
}
