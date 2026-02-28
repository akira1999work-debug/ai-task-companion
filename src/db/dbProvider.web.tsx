import React, { createContext, useContext, useState, useEffect } from 'react';
import { WebDatabase } from './webDatabase';

// ---------------------------------------------------------------------------
// Web-specific provider using sql.js
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
// Exports
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
    <WebSQLiteProvider onInit={onInit}>
      {children}
    </WebSQLiteProvider>
  );
}

export function useDatabase(): any {
  var webDb = useContext(WebDbContext);
  if (!webDb) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return webDb;
}
