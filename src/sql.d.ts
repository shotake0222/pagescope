// wrangler は .sql ファイルを文字列としてバンドルします
declare module '*.sql' {
  const content: string;
  export default content;
}
