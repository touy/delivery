import app from './app';
const port = Number(process.env.PORT) || 6678;
app.server.listen(port, (err:any) => {
    if (err) {
        return console.log(err);
    }
   app.setAutoRefresh(1000*60*5);
    return console.log(`server is listening on ${port}`);
  });
