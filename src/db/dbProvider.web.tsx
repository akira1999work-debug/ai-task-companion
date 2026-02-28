import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
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
  var [error, setError] = useState<string | null>(null);

  useEffect(function () {
    var webDb = new WebDatabase();
    webDb.init().then(function () {
      return onInit(webDb as any);
    }).then(function () {
      setDb(webDb);
      setReady(true);
    }).catch(function (e) {
      console.error('WebDatabase init failed:', e);
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
          データベース初期化エラー
        </Text>
        <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
          {error}
        </Text>
      </View>
    );
  }

  if (!ready || !db) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#666' }}>
          読み込み中...
        </Text>
      </View>
    );
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
