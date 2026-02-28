import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { WebDatabase } from './webDatabase';
import type { SQLiteDatabase } from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Web-specific provider
// ---------------------------------------------------------------------------

var WebDbContext = createContext<WebDatabase | null>(null);

function WebSQLiteProvider({
  children,
  onInit,
}: {
  children: React.ReactNode;
  onInit: (db: any) => Promise<void>;
}) {
  var [db, setDb] = useState<WebDatabase | null>(null);
  var [ready, setReady] = useState(false);

  useEffect(function () {
    var webDb = new WebDatabase();
    webDb.init().then(function () {
      return onInit(webDb as any);
    }).then(function () {
      setDb(webDb);
      setReady(true);
    }).catch(function (e) {
      console.error('WebDatabase init failed:', e);
    });
  }, []);

  if (!ready || !db) {
    return null;
  }

  return (
    <WebDbContext.Provider value={db}>
      {children}
    </WebDbContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Unified DatabaseProvider
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
  if (Platform.OS === 'web') {
    return (
      <WebSQLiteProvider onInit={onInit}>
        {children}
      </WebSQLiteProvider>
    );
  }

  return (
    <SQLiteProvider databaseName={databaseName} onInit={onInit}>
      {children}
    </SQLiteProvider>
  );
}

// ---------------------------------------------------------------------------
// Unified hook to get the database instance
// ---------------------------------------------------------------------------

export function useDatabase(): any {
  if (Platform.OS === 'web') {
    var webDb = useContext(WebDbContext);
    if (!webDb) {
      throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return webDb;
  }
  return useSQLiteContext();
}
