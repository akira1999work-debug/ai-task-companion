declare module 'sql.js' {
  interface Database {
    run(sql: string, params?: any[]): void;
    exec(sql: string): any[];
    prepare(sql: string): Statement;
    getRowsModified(): number;
    export(): ArrayLike<number>;
    close(): void;
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: object): Record<string, any>;
    free(): boolean;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  interface InitConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: InitConfig): Promise<SqlJsStatic>;
  export { Database, Statement };
}
