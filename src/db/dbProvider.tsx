import React from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Native provider using expo-sqlite
// ---------------------------------------------------------------------------

export function DatabaseProvider({
  children,
  databaseName,
  onInit,
}: {
  children: React.ReactNode;
  databaseName: string;
  onInit: (db: any) => Promise<void>;
}) {
  return (
    <SQLiteProvider databaseName={databaseName} onInit={onInit}>
      {children}
    </SQLiteProvider>
  );
}

export function useDatabase(): any {
  return useSQLiteContext();
}
