import * as moment from 'moment-timezone';
import * as express from "express";
// import * as crypto from 'crypto';
// import * as request from 'request';
import * as Nano from 'nano';
import * as async from 'async';
import * as uuidV4 from 'uuid';
import * as cors from 'cors';
import * as fs from 'fs';
import * as http from 'http';
import * as redis from 'redis';
// import * as __browser from 'detect-browser';
import * as path from 'path';
// import * as passwordValidator from 'password-validator';
var passwordValidator = require('password-validator');
import * as util from 'util';
import * as Q from 'q';
import * as bodyParser from 'body-parser';
import * as methodOverride from 'method-override';
import * as WebSocket from 'ws';
// import { RequestHandlerParams } from 'express-serve-static-core';
import { Request, NextFunction, ErrorRequestHandler, Response } from "express";
import { NextHandleFunction } from 'connect';
// import { POINT_CONVERSION_COMPRESSED } from 'constants';
// import * as jsesc from 'jsesc';
// import { Module } from 'module';//
//import debug = require("debug");
class App {
    private timeout = ms => new Promise(res => setTimeout(res, ms));
    add_latest(deviceinfo) {
        let deferred = Q.defer();
        let db = this.create_db('latest_record');
        db.list({ include_docs: true }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err)
            } else {
                try {
                    let d: any = {};
                    if (res.rows.length) {
                        //console.log(res);
                        for (let index = 0; index < res.rows.length; index++) {
                            const element = res.rows[index].doc;

                            if (element.data && element._id.indexOf('_design') < 0) {
                                if (moment(moment.now()).diff(deviceinfo.gpstime, 'minutes') < 3 && moment(moment.now()).diff(deviceinfo.gpstime, 'minutes') >= 0) {
                                    //console.log(element);
                                    if (element.data.lastreport.imei === deviceinfo.imei) {
                                        d = element;
                                        break;
                                    }
                                }else{
                                    if (moment(element.data.firstrun.gpstime).diff(deviceinfo.gpstime, 'minutes') < 0 || moment(element.data.firstpark.gpstime).diff(deviceinfo.gpstime, 'minutes') < 0) {
                                        if (element.data.lastreport.imei === deviceinfo.imei) {
                                            d = element;
                                            break;
                                        }
                                    }
                                    
                                }
                            }

                        }
                    }
                    else {
                        d.data = undefined;
                    }
                    if (d.data) {
                        if (!d.data.firstrun && deviceinfo.acc + '' === '1') {
                            d.data.firstrun = deviceinfo;
                        }
                        if (!d.data.firstpark && deviceinfo.acc + '' === '0') {
                            d.data.firstpark = deviceinfo;
                        }
                        // if (moment(d.data.firstrun.gpstime).diff(deviceinfo.gpstime, 'minutes') <= 0 || moment(d.data.firstpark.gpstime).diff(deviceinfo.gpstime, 'minutes') <= 0) {
                        //     if(deviceinfo.acc+''=='0'){
                        //         d.data.firstpark=deviceinfo;
                        //     }else {
                        //         d.data.firstrun=deviceinfo;
                        //     }
                        // }                        
                        if (d.data.lastreport) {                                                        
                            // if (!d.data.firststatus) {
                            //     d.data.firststatus = deviceinfo;
                            // }
                            if (deviceinfo.acc + '' !== d.data.lastreport.acc + '') {
                                d.data.firststatus = d.data.lastreport;
                                if (deviceinfo.acc + '' === '1' && d.data.lastreport.acc + '' === '0') {
                                    d.data.firstrun = deviceinfo;
                                }
                                if (deviceinfo.acc + '' === '0' && d.data.lastreport.acc + '' === '1') {
                                    d.data.firstpark = deviceinfo;
                                }
                            }
                        }
                    }
                    else {
                        d.data = {};
                        if (deviceinfo.acc + '' === '1') {
                            d.data.firstrun = deviceinfo;
                        }
                        if (deviceinfo.acc + '' === '0') {
                            d.data.firstpark = deviceinfo;
                        }
                        d.gui = uuidV4();
                        d._id = deviceinfo.imei;
                    }

                    // this.filterObject(d.data);
                    // console.log(d);
                    if (0) {
                        let d2 = JSON.parse(JSON.stringify(d));
                        delete d2._rev;
                        // console.log('DESTROY LATEST ', d);
                        db.destroy(d._id, d._rev, (err, res) => {
                            if (err) {
                                console.log(err, d);
                                deferred.reject(err);
                            } else {
                                // console.log('INSERTING latest ', d2);
                                db.insert(d2, d2._id, (err, res) => {
                                    if (err) {
                                        console.log(err, d);
                                        deferred.reject(err);
                                    } else {
                                        //console.log(res);
                                        deferred.resolve(d);
                                    }
                                });
                            }
                        });
                    } else {
                        // delete d._rev;
                        if (moment(moment.now()).diff(deviceinfo.gpstime, 'minutes') < 3 && moment(moment.now()).diff(deviceinfo.gpstime, 'minutes') >= 0) {
                            // console.log('INSERTING latest ', d);
                            d.data.lastreport = deviceinfo;
                            if (!d.data.icemakerbill) {
                                d.data.icemakerbill = {};
                                d.data.icemakerbill.productiontime = {};
                                d.data.icemakerbill.working = 0;
                                d.data.icemakerbill.parking = 0;
                                d.data.icemakerbill.problem = 0;
                            }
                            let c_working = d.data.icemakerbill.productiontime.working === undefined ? 0 : d.data.icemakerbill.productiontime.working;
                            let c_parking = d.data.icemakerbill.productiontime.parking === undefined ? 0 : d.data.icemakerbill.productiontime.parking;
                            let c_problem = 0;
                            // console.log('now ',moment().format());
                            // console.log('now date ',moment().toDate());
                            // console.log('gps time format',moment(deviceinfo.gpstime).format());
                            // console.log('gps time',moment(deviceinfo.gpstime).toDate());

                            // console.log('diff ',moment(moment.now()).diff(deviceinfo.gpstime, 'milliseconds'))
                            if (deviceinfo.acc === '1') {
                                c_working += (moment(moment.now()).diff(deviceinfo.gpstime, 'milliseconds') / 1000) / 3600;
                            }
                            else {
                                c_parking += (moment(moment.now()).diff(deviceinfo.gpstime, 'milliseconds') / 1000) / 3600;
                            }
                            let sn = moment(moment.now()).toDate().getFullYear() + '';
                            sn = ("0" + moment(moment.now()).toDate().getDate()).slice(-2) + '';
                            sn = ("0" + moment(moment.now()).toDate().getMonth() + 1).slice(-2) + '';
                            let bill = {
                                day: moment(moment.now()).toDate().getDate(),
                                month: moment(moment.now()).toDate().getMonth() + 1,
                                year: moment(moment.now()).toDate().getFullYear(),
                                lasteststatus: [],
                                productiondetails: [],
                                productiontime: {
                                    working: c_working,
                                    parking: c_parking,
                                    problem: c_problem
                                },
                                temps: [
                                    { hour: 0, temp: 0, wind: 0, outsidetemp: 0, humidity: 0, tempin: 0, tempmax: 0, weathertype: '', weatherdescription: '' }],
                                powerconsumption: [{ hour: 0, amp: 0, voltage: 0, watt: 0, pf: 0 },
                                ],
                                effeciency: 8, // get current effeciency by imei
                                rate: 250,// get current rate by imei
                                totalvalue: 0,
                                imei: deviceinfo.imei,
                                sn: 'R' + sn,
                                isdone: false,
                                paidtime: '',
                                description: '',
                                paymentgui: '',
                                paidby: '',
                                generatedtime: (moment().format()),
                                gui: uuidV4(),
                                _id: '',
                                lastupdate: [(moment().format())]
                            };
                            // console.log('bill: ');
                            // console.log(bill);
                            bill._id = bill.gui;
                            bill.totalvalue = bill.rate * bill.effeciency * bill.productiontime.working;
                            if (d.data.icemakerbill) {
                                d.data.icemakerbill.productiontime = bill.productiontime;
                                d.data.icemakerbill.totalvalue = bill.totalvalue;
                            } else {
                                d.data.icemakerbill = bill;
                            }
                            db.insert(d, d._id, (err, res) => {
                                if (err) {
                                    console.log(err);
                                    deferred.reject(err);
                                } else {
                                    //console.log(res);
                                    deferred.resolve(d);
                                }
                            });
                        } else {
                            if (!d.data.lastreport) {
                                d.data.lastreport = deviceinfo;
                            }
                            // db.insert(d, d._id, (err, res) => {
                            //     if (err) {
                            //         console.log(err);
                            //         deferred.reject(err);
                            //     } else {
                            //         //console.log(res);
                            //         deferred.reject(new Error('ERROR history data'));  
                            //     }
                            // }); 
                            // if(moment(deviceinfo.gpstime).toDate().getDate()===moment(moment.now()).toDate().getDate()&&moment(deviceinfo.gpstime).toDate().getMonth()===moment(moment.now()).toDate().getMonth()&&moment(deviceinfo.gpstime).toDate().getFullYear()===moment(moment.now()).toDate().getFullYear()){                                

                            // }
                            deferred.reject(new Error('ERROR history data'));

                        }
                    }

                } catch (error) {
                    console.log(error);
                    deferred.reject(error);
                }
            }
        });

        return deferred.promise;
    }
    refresh_data(deviceinfo) {
        let deferred = Q.defer();
        let js: any = {};
        js.client = {};
        js.client.data = {};
        this.add_latest(deviceinfo).then(res => {
            js.client.data.lastreport = res;
            js.client.data.message = 'OK add latest';
            console.log('inserted latest' + deviceinfo.imei);
            if (this.wss.clients.size) {
                this.wss.clients.forEach((ws) => {
                    console.log('find online users');
                    if (ws.readyState === ws.OPEN) {
                        this.findDeviceByImei(deviceinfo.imei).then(async res => {
                            console.log('found imei', deviceinfo.imei);
                            let d = res[0];
                            if (d) {
                                let usernames = d.ownername;
                                let js2: any = { client: ws['client'] };
                                js2.client.data = {};
                                js2.client.data.command = 'get-realtime-working-status';
                                js2.client.data.message = 'OK realtime last report';
                                // this.getUserByLoginToken(js2).then(res=>{
                                //     console.log('found online user ',res);
                                //js2 = res;                                    
                                //console.log(js2.client);
                                if (usernames.indexOf(js2.client.username) > -1) {
                                    console.log('sending to user ', js2.client.username);
                                    js2.client.data.lastreport = js.client.data.lastreport;
                                    let b = Buffer.from(JSON.stringify(js2['client'])).toString('base64');
                                    ws.send(JSON.stringify(b), {
                                        binary: true
                                    });

                                }
                                //ws.close();
                                deferred.resolve('OK send device a realtime status update');

                                // }).catch(err => {
                                //     console.log(err);
                                //     deferred.reject(err);
                                // });
                            }
                            else {
                                deferred.reject(new Error('ERROR not found device ' + res['data'].lastreport.imei));
                            }

                        }).catch(err => {
                            console.log(err);
                            deferred.reject(err);
                        });

                    } else {
                        deferred.reject('ERROR connection close');
                    }

                });
            } else {
                deferred.reject('No online users');
            }


        }).catch(err => {
            console.log(err);
            js.client.data.message = err;
            deferred.reject(js);
        });
        // this.r_client.set(this._current_system + '_imei_' + client.deviceinfo.imei, JSON.stringify(client));        
        return deferred.promise;
    }
    initWebsocket(): any {
        //debug()
        let parent = this;

        this.ws_client = new WebSocket(this._usermanager_ws); // user-management

        this.wss.on('connection', async (ws, req) => {
            const ip = req.connection.remoteAddress;
            console.log('connection from ' + ip);
            //const ip = req.headers['x-forwarded-for'];
            ws['isAlive'] = true;
            ws.binaryType = 'arraybuffer';

            ws['client'] = {};
            ws['client'].auth = {};
            ws['gui'] = '';
            ws['lastupdate'] = moment(moment.now()).toDate();
            console.log('DECLARE MESSAGE ', ws.readyState);
            ws.on('message', (data) => {
                let js: any = {};
                try {
                    console.log('comming message');
                    let b = parent.ab2str(data);
                    // console.log('1');
                    //console.log(b);
                    let s = Buffer.from(b, 'base64').toString();
                    // console.log('2');
                    // console.log(s);
                    js['client'] = JSON.parse(s);
                    //console.log(js.client)
                    js['ws'] = ws;
                    ws['lastupdate'] = moment(moment.now()).toDate();
                    ws['isAlive'] = true;
                    ws['gui'] = js['client'].gui;
                    // this.checkConnection(ws['gui']);

                    js['client'].auth = {};
                    ws['client'] = JSON.parse(JSON.stringify(js['client']));
                    console.log('command ', ws['client'].data.command);
                    parent.commandReader(js).then(res => {
                        js = res;
                        ws['gui'] = js['client'].gui;
                        ws['client'] = JSON.parse(JSON.stringify(js['client']));
                        ws['lastupdate'] = moment(moment.now()).toDate();

                        if (res['client'].data.command === 'logout') {
                            ws['gui'] = '';
                            ws['client'] = {};
                            ws['lastupdate'] = '';
                        }
                        if (parent._system_prefix.indexOf(js['client'].prefix) < 0) {
                            console.log('clear auth')
                            delete js['client'].auth;
                            //parent.filterObject(js['client'].data);
                        }
                        console.log('sending');
                        // console.log(js['client']);
                        // js['client'].data.message+=' TEST non english ຍັງຈັບສັນຍານ GPS ບໍ່ໄດ້ ເລີຍບໍ່ທັນ ONLINE ແຕ່ໂທໄດ້, ຕັ້ງຄ່າໄດ້ແລ້ວ';

                        // console.log(98);
                        // console.log(b);
                        // let a = Buffer.from(b);
                        // console.log(a);
                        // console.log(102);
                        console.log(js.client.data.command);
                        if (ws.readyState === ws.OPEN) {
                            let b = Buffer.from(JSON.stringify(js['client'])).toString('base64');
                            ws.send(JSON.stringify(b), {
                                binary: true
                            });
                        }
                    }).catch(err => {
                        js = err;
                        var l = {
                            log: js['client'].data.message,
                            logdate: moment(moment.now()),
                            type: "error",
                            gui: uuidV4()
                        };
                        //console.log(err);
                        parent.errorLogging(l);
                        console.log('ws sending');
                        ws['client'] = JSON.parse(JSON.stringify(js['client']));
                        ws['lastupdate'] = moment(moment.now()).toDate();
                        js['client'].data.message = js['client'].data.message.message;
                        parent.filterObject(js['client'].auth);
                        let b = Buffer.from(JSON.stringify(js['client'])).toString('base64');
                        //console.log(b);
                        // let a = Buffer.from(b);
                        //console.log(a);
                        if (ws.readyState === ws.OPEN) {

                            ws.send(JSON.stringify(b), {
                                binary: true
                            });
                        }
                    });
                } catch (error) {
                    console.log(error);
                    js['client'].data.message = error.message;
                    ws['client'] = JSON.parse(JSON.stringify(js['client']));
                    ws['lastupdate'] = moment(moment.now()).toDate();
                    parent.filterObject(js['client'].auth);
                    let b = Buffer.from(JSON.stringify(js['client'])).toString('base64');
                    //console.log(b);
                    // let a = Buffer.from(b);
                    //console.log(a);
                    if (ws.readyState === ws.OPEN) {

                        ws.send(JSON.stringify(b), {
                            binary: true
                        });
                    }
                }

            });

            ws.on('pong', () => {
                try {
                    ws['isAlive'] = true;
                    if (!ws['lastupdate'] && !ws['gui']) {
                        ws['isAlive'] = false;
                    }
                    let startDate = moment(ws['lastupdate']).toDate()
                    let endDate = moment(moment.now());
                    const timeout = endDate.diff(startDate, 'seconds');
                    if (timeout > 60 * 15)
                        ws['isAlive'] = false;
                    else
                        ws['isAlive'] = true;
                    // parent.wss.clients.forEach(element => {
                    //     let client = element['client'];
                    //     //parent.setLoginStatus(client);
                    //     //parent.setClientStatus(client);
                    //     //this.setOnlineStatus(client);                    
                    // });
                } catch (error) {
                    console.log(error);
                }
            });
            ws.on('error', (err) => {
                //js.client.data.message=JSON.stringify(err);
                console.log(err);
                var l = {
                    log: err,
                    logdate: moment().toDate(),
                    type: "error",
                    gui: uuidV4()
                };
                parent.errorLogging(l);
            });

        });
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                try {
                    if (ws['isAlive'] === false || !ws['isAlive']) {

                        console.log(ws['isAlive'] + 'TERMINATE ws ' + ws['gui']);
                        return ws.terminate();
                    }
                    console.log('TIME INTERVAL');
                    ws['isAlive'] = false;
                    ws.ping(() => { });
                } catch (error) {
                    console.log(error);
                }
            });
        }, 60000); // set 60 seconds         


    }
    setAutoRefresh(intervaltime = 1000 * 5 * 60) {
        let parent = this;
        const rep_interval = setInterval(async () => {
            let hourreport = 0;
            let dayreport = 0;
            hourreport++;// 60/5 = 12
            dayreport++;// 24*60/5 = 288 
            if (dayreport >= 288) {
                dayreport = 0;
            } else if (hourreport >= 12) {
                hourreport = 0;
            } else {

            }
            if (1) {
                try {
                    let devices: any = await parent.findDeviceByUsername('ice-maker-admin');
                    console.log(devices.length);
                    if (devices.length) {
                        let array = devices;
                        let y = moment().year() + '';
                        let m = (moment().month() + 1) + '';
                        let d = moment().date() + '';

                        for (let index = 0; index < array.length; index++) {
                            const element = array[index];
                            let res = await parent.get_production_time_manual(element.imei, y, m, d) as any;
                            if (res._id) {
                                console.log(res._id);
                            } else {
                                console.log(res);
                            }
                            //console.log(res);
                        }

                    }
                } catch (error) {
                    console.log(error);
                }

            }

        }, intervaltime);
    }
    checkConnection(gui) {
        let client_count=0;
        this.wss.clients.forEach((ws) => {
            try {
                if (ws['gui'] === gui) {
                    if(client_count){
                        return;
                    }
                    client_count++;
                    ws['isAlive'] = true;                    
                    ws['lastupdate'] = (moment().toDate());
                }
            } catch (error) {
                console.log(error);
            }
        });
    }


    private _system_prefix = ['ice-maker', 'gij', 'web-post', 'user-management'];
    private ws_client: WebSocket;
    private wsoption: WebSocket.ServerOptions;
    private wss: WebSocket.Server;
    public server: http.Server;
    private _usermanager_host: string;
    private _usermanager_ws: string;
    private app: express.Application = express();
    private nano: any;
    private r_client: redis.RedisClient;
    private passValidator: any;
    private userValidator: any;
    private phoneValidator: any;
    private _current_system: string;
    private __design_view: string = "objectList";
    private __design_raw_gen = {
        "_id": "_design/objectList",
        "views": {
            "searchByGPSTIMELATLON": {
                "map": "function (doc) {\r\n doc.gpstime=doc.gpstime.replace('+07:00','');  var d = new Date(doc.gpstime);\r\n                if (d != null) {\r\n                    var key = [d.getTime(),\r\n                               doc.lat,\r\n                               doc.lon\r\n                               ];\r\n                               \r\n                        emit(key, null);\r\n                }\r\n}\r\n"
            },
            "findByYEARMONTH": {
                "map": "\r\nfunction (doc) {\r\n doc.gpstime=doc.gpstime.replace('+07:00','');  var d = new Date(doc.gpstime);\r\n                if (d != null) {\r\n                    var key = [\r\n                      d.getFullYear(),\r\n                      d.getMonth()+1\r\n                               ];\r\n                               \r\n                        emit(key, null);\r\n                }\r\n}\r\n"
            },
            "countByYEARMONTH": {
                "reduce": "_count",
                "map": "\r\nfunction (doc) {\r\n doc.gpstime=doc.gpstime.replace('+07:00','');  var d = new Date(doc.gpstime);\r\n                if (d != null) {\r\n                    var key = [\r\n                      d.getFullYear(),\r\n                      d.getMonth()+1\r\n                               ];\r\n                               \r\n                        emit(key, null);\r\n                }\r\n}\r\n"
            }
        },
        "language": "javascript"
    }
    private __design_latest = {
        "_id": "_design/objectList",
        "views": {
            "byIMEIGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime],null);\n}"
            },
            "byIMEIACCGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.acc,doc.gpstime],null);\n}"
            },

            "countIMEIGPSTIME": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime], 1);\n}"
            },
            "byIMEIGPSYEARMONTHDATE": {
                "map": "function (doc) {\n  doc.gpstime=doc.gpstime.replace('+07:00','');   var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            },
            "countIMEIGPSYEARMONTHDATE": {
                "reduce": "_count",
                "map": "function (doc) {\n  doc.gpstime=doc.gpstime.replace('+07:00','');   var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            }
        },
        "language": "javascript"
    }
    private __design_working = {
        "_id": "_design/objectList",
        "views": {
            "by_id": {
                "map": "function (doc) {\n  emit(doc._id,null);\n}"
            },
            "byIMEIGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime],null);\n}"
            },
            "countIMEIGPSTIME": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime], 1);\n}"
            },
            "byIMEIGPSYEARMONTHDATE": {
                "map": "function (doc) {\n doc.gpstime=doc.gpstime.replace('+07:00','');    var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            },
            "countIMEIGPSYEARMONTHDATE": {
                "reduce": "_count",
                "map": "function (doc) {\n  doc.gpstime=doc.gpstime.replace('+07:00','');   var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            }
        },
        "language": "javascript"
    }
    private __design_parking = {
        "_id": "_design/objectList",
        "views": {
            "by_id": {
                "map": "function (doc) {\n  emit(doc._id,null);\n}"
            },
            "byIMEIGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime],null);\n}"
            },
            "countIMEIGPSTIME": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime], 1);\n}"
            },
            "byIMEIGPSYEARMONTHDATE": {
                "map": "function (doc) {\n doc.gpstime=doc.gpstime.replace('+07:00','');    var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            },
            "countIMEIGPSYEARMONTHDATE": {
                "reduce": "_count",
                "map": "function (doc) {\n  doc.gpstime=doc.gpstime.replace('+07:00','');   var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            }
        },
        "language": "javascript"

    };
    private __design_status = {
        "_id": "_design/objectList",
        "views": {
            "byIMEIGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime],null);\n}"
            },
            "countIMEIGPSTIME": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime], 1);\n}"
            },
            "byIMEIGPSYEARMONTHDATE": {
                "map": "function (doc) {\n doc.gpstime=doc.gpstime.replace('+07:00','');    var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            },
            "countIMEIGPSYEARMONTHDATE": {
                "reduce": "_count",
                "map": "function (doc) {\n   doc.gpstime=doc.gpstime.replace('+07:00','');  var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            }
        },
        "language": "javascript"
    };
    private __design_alarm = {
        "_id": "_design/objectList",
        "views": {
            "byIMEIGPSTIME": {
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime],null);\n}"
            },
            "countIMEIGPSTIME": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit([doc.imei,doc.gpstime], 1);\n}"
            },
            "byIMEIGPSYEARMONTHDATE": {
                "map": "function (doc) {\n doc.gpstime=doc.gpstime.replace('+07:00','');     var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            },
            "countIMEIGPSYEARMONTHDATE": {
                "reduce": "_count",
                "map": "function (doc) {\n  doc.gpstime=doc.gpstime.replace('+07:00','');   var d = new Date(doc.gpstime); \nif (d != null) {\n var key = [d.getFullYear(),\d.getMonth()+1,d.getDate()\n];\nemit([key,doc.imei], null);\n} \n}"
            }
        },
        "language": "javascript"
    }
    private __design_device = {
        "_id": "_design/objectList",
        "views": {
            "findByOwnerName": {
                "map": "function(doc) {\r\n for(var i=0;i<doc.ownername.length;i++) emit([doc.ownername[i]], null);\r\n}"
            },
            "findByImei": {
                "map": "function(doc) {\r\n    if(doc.imei) {\r\n        emit(doc.imei,null);\r\n    }\r\n}"
            },
            "countUsername": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit(doc.username, 1);\n}"
            },
            "countUserGUI": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit(doc.usergui, 1);\n}"
            },
            "byUsername": {
                "map": "function (doc) {\n  emit(doc.username, null);\n}"
            },
            "byUserGUI": {
                "map": "function (doc) {\n  emit(doc.usergui, null);\n}"
            },
            "byParent": {
                "map": "function (doc) {\n  emit(doc.parent, null);\n}"
            },
            "countParent": {
                "reduce": "_count",
                "map": "function (doc) {\n  emit(doc.parent, 1);\n}"
            }
        },
        "language": "javascript"

    }
    private __design_icemakerpayment: any = {
        "_id": "_design/objectList",
        "views": {
            "findByGui": {
                "map": `function (doc){
                if(doc.gui)
                emit(doc.gui,null);
            }`
            },
            "findByUsername": {
                "map": `function (doc) {
                doc.gpstime=doc.gpstime.replace('+07:00','');
                var d = new Date(doc.paidtime);
                                     emit([doc.paidby,d], null);                             
                             
                             //emit(null,d.getMonth());
             }`
            },
            "findByImeiPaidTime": {
                "map": ` function (doc) {
                doc.gpstime=doc.gpstime.replace('+07:00','');
                var d = new Date(doc.paidtime);   
                                     emit([doc.imei,d], null);                             
                             
                             //emit(null,d.getMonth()+1);
             }`
            },
            "findByIMEI": {
                "map": ` function (doc) {
                                     emit([doc.imei], null);                             
                             
                             //emit(null,d.getMonth()+1);
             }`
            }
        },
        "language": "javascript"
    };

    private __design_icemakerbill: any = {
        "_id": "_design/objectList",
        "views": {
            "findByImeiAndSn": {
                "map": ` function (doc) {
                                            
                emit([doc.imei,doc.sn], null);
             }`,
            }
        },
        "language": "javascript"
    };

    private deviceinfo: deviceinfo;


    constructor() {
        this.convertTZ(moment.now());
        this._current_system = 'ice-maker';
        this._usermanager_host = 'http://nonav.net:6688';
        // this._usermanager_ws = 'ws://nonav.net:6688';
        this._usermanager_ws = 'ws://localhost:6688';

        this.nano = Nano('http://admin:admin@localhost:5984');

        this.r_client = redis.createClient();


        this.config();

        this.initWebsocket();
        this.r_client.monitor((err: any, res: any): any => {
            console.log("Entering monitoring mode.");
        });
        this.r_client.on('monitor', this.monitor_redis.bind(this));

        this.passValidator = new passwordValidator();
        this.passValidator.is().min(6) // Minimum length 8 
            .is().max(100) // Maximum length 100 
            //.has().uppercase()                              // Must have uppercase letters 
            .has().lowercase() // Must have lowercase letters 
            .has().digits() // Must have digits 
            .has().not().spaces()


        this.userValidator = new passwordValidator();
        this.userValidator.is().min(3)
            .is().max(12)
            .has().digits()
            .has().lowercase()
            .has().not().spaces();
        this.phoneValidator = new passwordValidator();
        this.phoneValidator.is().min(9)
            .has().digits()
            .has().not().spaces();



        this.initDB();
        setTimeout(() => {
            console.log('restoring working record , parking record');
            try {

                //this.restoreWorkingRecord();

                //  this.generateRaws().then(res=>{
                //     console.log(res);      
                // this.insertFromRawGen(2018,2).then(res=>{
                //     console.log(res);
                //     console.log('insert Feb');
                //     this.insertFromRawGen(2018,3).then(res=>{
                //         console.log('insert March');
                //     }).catch(err=>{
                //         console.log(err);
                //     });
                // }).catch(err=>{
                //     console.log(err);
                // });          
                //  }).catch(err=>{
                //      console.log(err);
                //  });
                // try to remove +7:00 from servertime and
                // this.fixDB().then(res => {
                //     console.log('total fixed ' + res)
                // }).catch(err => {
                //     console.log(err);
                //     throw err;
                // });



                // this.deleteAllWorkingDoc().then(res => {
                //     this.restoreWorkingBackupFile();
                // }).catch(err=>{
                //     console.log(err);
                // });
                // this.deleteAllParkingDoc().then(res => {
                //     //console.log(res);
                //     this.restoreParkingBackupFile();
                // }).catch(err => {
                //     console.log(err);
                // });
                // //  this.generateRaws().then(res=>{
                // //     console.log(res);

                // //  }).catch(err=>{
                // //      console.log(err);
                // //  });
                // this.insertFromRawGen(2018,2).then(res=>{
                //     console.log(res);
                //     console.log('insert Feb');
                //     this.insertFromRawGen(2018,3).then(res=>{
                //         console.log('insert March');
                //     }).catch(err=>{
                //         console.log(err);
                //     });
                // }).catch(err=>{
                //     console.log(err);
                // });

                // this.restoreRawRecord().then(res => {

                // }).catch(err => {
                //     console.log(err);
                //     throw err;
                // });

                // this.getBy_ID('b15f46a7-b8ec-4364-ae03-566c6c7005a8','working_record').then(res=>{
                //     console.log(res);
                // }).catch(err=>{
                //     console.log(err);
                // });

            } catch (error) {
                console.log(error);
            }
        }, 1000 * 3);


        this.detect_db_changes();
    }





    errorHandler(err: ErrorRequestHandler, req: Request, res: Response, next: NextHandleFunction): any {

        console.log(err);
        var l = {
            log: err,
            logdate: (moment().format()),
            type: "error",
            gui: uuidV4()
        };
        this.errorLogging(l);
        if (res.headersSent) {
            return next(req, res, null);
        }
        res.status(500);
        res.render('error', {
            error: err
        });
    }
    errorLogging(log) {
        var db = this.create_db("errorlogs");
        console.log(log);
        db.insert(log, log.gui, (err, body) => {
            if (err) console.log(err);
            else {
                console.log("log oK ");
            }
        });
    }
    create_db(dbname) {
        let db;
        this.nano.db.create(dbname, (err, body) => {
            // specify the database we are going to use    
            if (!err) {
                console.log('database ' + dbname + ' created!');
            } else
                console.log(dbname + " could not be created!");
        });
        db = this.nano.use(dbname);
        return db;
    };
    detect_db_changes() {
        let parent = this;
        let db = this.create_db('working_record');
        let feed = db.follow({ since: "now", include_docs: true });
        feed.on('change', function (change) {
            console.log("CHANGED: ", change);
            let d = change.doc;
            if(d){
                parent.refresh_data(d).then(res => {
                    console.log(res);
                }).catch(err => {
                    console.log('ERORR: ', err);
                    //throw err;
                });
            }
        });
        feed.follow();
    }
    convertTZ(fromTZ) {

        // return new Date(new Date(fromTZ).toLocaleString('en-US', {
        //     timeZone: 'Asia/Vientiane'
        //   }));
        process.env.TZ = 'Asia/Vientiane';
        //if(moment)
        //moment().format();     
        return moment(moment.tz(fromTZ, "Asia/Vientiane").format().replace('+07:00', ''));
    }
    wscallback(res: boolean, code: number, msg: string): void {
        console.log('%s,%s,%s', res, code, msg);
    }
    private config(): void {
        this.app.set('trust proxy', true);
        this.app.use(methodOverride());
        this.app.use(cors());
        this.app.use(bodyParser.json());
        // this.app.use(bodyParser.urlencoded({ extended: false }));
        this.server = http.createServer(this.app);
        this.routes();


        /// WEBSOCKET
        this.wsoption = {};
        this.wsoption.server = this.server;
        this.wsoption.perMessageDeflate = false;
        this.wss = new WebSocket.Server(this.wsoption);

    }
    private routes(): void {
        const router = express.Router();
        this.app.use('/public', express.static(__dirname + '../../../public'));
        this.app.use(this.errorHandler);
        router.all('/', (req: Request, res: Response) => {
            this.clog('OK Test');
            res.sendFile(path.join(__dirname + '../../../index.html'));
        });
        router.all('/cleanBillAndPayment', (req: Request, res: Response) => {
            this.cleanBillAndPayment().then(r => {
                res.send(r);
            }).catch(err => {
                res.send(err);
            });
            this.clog('clean OK');

        });
        this.app.use('/', router);

        // this.app.all('/', (req: Request, res: Response) => {
        //     this.clog('OK Test');
        //     res.sendFile(path.join(__dirname + '../../../index.html'));
        // });
    }
    monitor_redis(time: any, args: any, raw_reply: any): redis.Callback<undefined> {
        //console.log(time + ": " + args); // 1458910076.446514:['set', 'foo', 'bar']
        try {
            args = args.toString();
            if (args.indexOf('set') != 0) //capture the set command only
                return;
            //args=args.replace('\\','');
            //console.log('getjs');
            let js = args.substring(args.indexOf('{'), args.lastIndexOf('}') + 1);
            //console.log(js);
            js = JSON.parse(js);
            let arr = args.split(',');
            //console.log(arr);
            let command = arr[0];
            let k = arr[1];
            let mode = '';
            let timeout = 0;
            if (arr[arr.length - 1].indexOf('}') < 0) {
                mode = arr[arr.length - 2];
                timeout = arr[arr.length - 1]
            }
            let clients = this.wss.clients;
            try {
                if (command == "set")
                    if (clients) {
                        clients.forEach((ws) => {
                            const element = ws;
                            //console.log(element['client']);
                            if (this._current_system + "_client_" + element['gui'] == k) {
                                console.log('client-changed');
                                let b = Buffer.from(JSON.stringify(element['client'])).toString('base64');
                                element.send((JSON.stringify(b)), { binary: true });
                            }
                            if (this._current_system + "_error_" + element['gui'] == k) {
                                console.log('error-changed');
                                var l = {
                                    log: JSON.stringify(js),
                                    logdate: (moment().format()),
                                    type: "error",
                                    gui: uuidV4()
                                };
                                this.errorLogging(l);
                                let b = Buffer.from(JSON.stringify(element['client'])).toString('base64');
                                element.send((JSON.stringify(b)), { binary: true });
                            }
                            if (this._current_system + "_login_" + element['client'].logintoken == k) {
                                let js: any = {};
                                js.client.logintoken = element['client'].logintoken;
                                js.client.data = {};
                                js.client.data.command = 'NONE';
                                this.getUserInfoByLoginToken(js).then(res => {
                                    js = res;
                                    this.getUserByGUI(js).then(res => {
                                        let u = js.client.data.user;
                                        this.findDeviceByUsername(u.username).then(res => {
                                            if (Array.isArray(res)) {
                                                if (res.length) {
                                                    for (let index = 0; index < res.length; index++) {
                                                        const d = res[index];
                                                        if (this._current_system + "_imei_" + d.imei === k) {
                                                            console.log('device status changed');
                                                            // if (_system_prefix.indexOf(element.client.prefix) > -1)
                                                            let b = Buffer.from(JSON.stringify(element['client'])).toString('base64');
                                                            element.send((JSON.stringify(b)), { binary: true });
                                                        }
                                                    }
                                                }
                                            }

                                        });
                                    }).catch(err => {
                                        console.log(err);
                                    });

                                }).catch(err => {
                                    console.log(err);

                                });

                            }


                        });
                    }

            } catch (error) {
                console.log(error);
            }
        } catch (error) {
            console.log(time + ": " + args); // 1458910076.446514:['set', 'foo', 'bar']
            console.log(error);
        }
    };
    cleanWorkingRecord() {

    }
    cleanParkingRecord() {

    }
    cleanLatestRecord() {

    }
    cleanAlarmRecord() { }
    cleanRaws() {

    }
    cleanStatus() {

    }
    cleanDevices() {

    }
    bakWorkingRecord() {

    }
    bakParkingRecord() {

    }
    bakLatestRecord() {

    }
    bakAlarmRecord() { }
    bakRaws() {

    }
    bakStatus() {

    }
    bakDevices() {

    }
    initDB(): void {
        // init_db('icemaker_device', __design_icemakerdevice);
        this.init_db('icemaker_payment', this.__design_icemakerpayment);
        this.init_db('icemaker_bill', this.__design_icemakerbill);
        this.init_db('icemaker_device', this.__design_device);
        // init_db('raws', __design_raw);
        this.init_db('working_record', this.__design_working);
        this.init_db('latest_record', this.__design_latest);
        this.init_db('parking_record', this.__design_parking);
        this.init_db('raws_gen', this.__design_raw_gen);
        //this.init_db('alarm_record', this.__design_alarm);
        // init_db('status_record', __design_status);        
    }
    init_db(dbname, design): void {
        // create a new database
        var db;
        async.eachSeries([
            db = this.create_db(dbname),
            db = this.nano.use(dbname),
            db.insert(design, (err, res) => {
                if (err) {
                    db.get('_design/objectList', (err, res) => {
                        console.log(dbname);
                        if (err) console.log('could not find design ' + err.message);
                        else {
                            if (res) {
                                var d = res;
                                //console.log("d:"+JSON.stringify(d));
                                db.destroy('_design/objectList', d._rev, (err, res) => {
                                    if (err) console.log(err);
                                    else {
                                        //console.log(res);
                                        db.insert(design, "_design/objectList", (err, res) => {
                                            if (err) console.log('err insert new design ' + dbname);
                                            else {
                                                //console.log('insert design completed ' + dbname);
                                            }
                                        });
                                    }
                                });
                            } else {
                                // console.log("could not find design");
                            }
                        }
                    });
                } else {
                    //console.log('created design ' + dbname);
                }

            })
        ], (err) => {
            console.log('exist ' + dbname);
        });
        //db = nano.use(dbname);
        //return db;
    }





    cleanBillAndPayment() {
        let deferred = Q.defer();
        try {
            let db_payment = this.create_db('icemaker_payment');
            let db_bill = this.create_db('icemaker_bill');
            db_payment.list((err, res) => {
                if (err) { console.log(err); deferred.reject(err) }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        if (element._id.indexOf('_design') > -1) {
                            continue;
                        }
                        element._deleted = true;
                        arr.push(element);
                    }
                    db_payment.bulk({
                        docs: arr
                    }, (err, res) => {
                        if (err) { console.log(err); deferred.reject(err); }
                        else {
                            db_bill.list((err, res) => {
                                if (err) { console.log(err); deferred.reject(err); }
                                else {
                                    let arr = [];
                                    for (let index = 0; index < res.rows.length; index++) {
                                        const element = res.rows[index].doc;
                                        if (element._id.indexOf('_design') > -1) {
                                            continue;
                                        }
                                        element._deleted = true;
                                        arr.push(element);
                                    }
                                    db_bill.bulk({
                                        docs: arr
                                    }, (err, res) => {
                                        if (err) { console.log(err); deferred.reject(err); }
                                        else {
                                            deferred.resolve('OK deleted all');
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } catch (error) {
            deferred.reject(error);
        }


        return deferred.promise;
    }
    login_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.data.command2 = js.client.data.command;
        client.data.command = 'login';
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        try {
            // if(ws_client.readyState!==WebSocket.OPEN){
            console.log('before sending login data');
            //console.log(client);
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        js.client.data.message = err;
                        deferred.reject(js);
                    }
                });
            });

            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                //delete data.res.SendSMSResult.user_id;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                if (client['command'] !== undefined) {
                    parent.setNotificationStatus(client);
                    parent.setLoginStatus(client);
                    console.log('622');
                    parent.setClientStatus(client);

                    //client.data.message = '';                          
                }

                js.client = client;
                console.log(js.client);
                ws_client.close();
                deferred.resolve(js)
            });
            ws_client.on("error", (err) => {
                ws_client.close();
                parent.setErrorStatus(client);
                js.client.data.message = err;
                deferred.reject(js);
            });
        } catch (error) {
            console.log('login error');
            console.log(error);
        }

        return deferred.promise;
    }
    getUsersByParent(js) {
        let deferred = Q.defer();
        console.log('GET USER BY PARENT');
        let client = JSON.parse(JSON.stringify(js.client));
        //console.log(client);
        client.data.command2 = client.data.command;
        client.data.command = 'get-user-list';
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        try {

            // if(ws_client.readyState!==WebSocket.OPEN){
            console.log('before sending get user list');
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        js.client.data.message = err;
                        deferred.reject(js);
                    }
                });
            });

            ws_client.on('message', (data) => {
                console.log('get data');
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                //delete data.res.SendSMSResult.user_id;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                if (client['command'] !== undefined) {
                    parent.setNotificationStatus(client);
                    parent.setLoginStatus(client);
                    parent.setClientStatus(client);
                    //client.data.message = '';                      
                }
                js.client = client;
                console.log('GET USER LIST FROM SERVER ');
                //console.log(js.client);
                ws_client.close();
                deferred.resolve(js)
            });
            ws_client.on("error", (err) => {
                ws_client.close();
                parent.setErrorStatus(client);
                js.client.data.message = err;
                deferred.reject(js);
            });
        } catch (error) {
            console.log('login error');
            console.log(error);
        }
        return deferred.promise;
    }
    reset_sub_user_password_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.data.command2 = client.data.command;
        client.data.command = 'reset-password-sub-user';
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        try {
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        js.client.data.message = err;
                        deferred.reject(js);
                    }
                });
            });

            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                //delete data.res.SendSMSResult.user_id;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                if (client['command'] !== undefined) {
                    parent.setNotificationStatus(client);
                    parent.setLoginStatus(client);
                    parent.setClientStatus(client);
                    //client.data.message = '';                      
                }
                js.client = client;
                ws_client.close();
                deferred.resolve(js)
            });
            ws_client.on("error", (err) => {
                ws_client.close();
                parent.setErrorStatus(client);
                js.client.data.message = err;
                deferred.reject(js);
            });
        } catch (error) {
            console.log('login error');
            console.log(error);
        }
        return deferred.promise;
    }
    update_sub_userinfo_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.data.command2 = client.data.command;
        client.data.command = 'update-sub-userinfo';
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        try {
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        js.client.data.message = err;
                        deferred.reject(js);
                    }
                });
            });

            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                //delete data.res.SendSMSResult.user_id;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                if (client['command'] !== undefined) {
                    parent.setNotificationStatus(client);
                    parent.setLoginStatus(client);
                    parent.setClientStatus(client);
                    //client.data.message = '';                      
                }
                js.client = client;
                ws_client.close();
                deferred.resolve(js)
            });
            ws_client.on("error", (err) => {
                ws_client.close();
                parent.setErrorStatus(client);
                js.client.data.message = err;
                deferred.reject(js);
            });
        } catch (error) {
            console.log('login error');
            console.log(error);
        }
        return deferred.promise;
    }
    getSubUsers(js) {
        let deferred = Q.defer();
        try {
            this.getUsersByParent(js).then(res => {
                js.client.data.message = 'OK get sub users';
                deferred.resolve(js);
            }).catch(err => {
                { console.log(err); deferred.reject(err); }
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }


        return deferred.promise;
    }
    addSubUser(js) {
        let deferred = Q.defer();
        try {
            let client = JSON.parse(JSON.stringify(js.client));
            console.log('adding sub user');
            // console.log(client);
            client.data.command = 'add-sub-user';
            client.data.command2 = js.client.data.command
            client.prefix = 'ice-maker';
            let ws_client = new WebSocket(this._usermanager_ws); // user-management
            ws_client.binaryType = 'arraybuffer';
            let parent = this;
            console.log('add sub user');
            ws_client.on('open', function open() {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, function (err) {
                    if (err) {
                        parent.setErrorStatus(client);
                        js.client.data.message = err;
                        deferred.reject(js);
                    }
                });
            });
            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                console.log('get result add sub user');
                delete client.prefix;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                js.client = client;
                ws_client.close();
                deferred.resolve(js)
            });
            ws_client.on("error", (err) => {
                ws_client.close();
                parent.setErrorStatus(client);
                js.client.data.message = err;
                deferred.reject(js);
            });
        } catch (error) {
            console.log(error);
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }
    register_finance_user_ws(js) {
        let deferred = Q.defer();
        let k = js.client.auth.gui;
        try {
            let user = JSON.parse(JSON.stringify(js.client.data.user));
            this.findUserByUsername(js).then(res => {
                // if (!Array.isArray(res)) {
                //     res = [res];
                // }
                res = res['client'].data.user;
                if (Array.isArray(res)) {
                    if (res.length) {
                        js.client.data.message = 'ERROR username exist';
                        deferred.reject(js);
                    } else {

                        let gui = js.client.auth.gui;
                        js.client.data.user = user;
                        js.client.data.user.gui = uuidV4();
                        js.client.data.user.parents = ['ice-maker-admin'];
                        js.client.data.user.roles = ['user', 'finance'];
                        js.client.data.user.system = ['ice-maker'];
                        // js.client.data.user.system.push('default');
                        // js.client.data.user.system.push('gij');
                        js.client.data.user.createddate = (moment().format()),
                            js.client.data.user.lastupdate = (moment().format()),
                            js.client.data.user.isactive = true;
                        // let u = js.client.data.user;
                        this.addSubUser(js).then(res => {
                            js.client.data.message = 'OK add sub-user';
                            deferred.resolve(js);
                        });
                    }
                }
            }).catch(err => {
                { console.log(err); deferred.reject(err); }
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }
    register_new_user_ws(js) {
        let deferred = Q.defer();
        let k = js.client.auth.gui;
        try {
            console.log('1040');
            let user = JSON.parse(JSON.stringify(js.client.data.user));
            user.username = user.username.toLowerCase();
            this.findUserByUsername(js).then(res => {
                // if (!Array.isArray(res)) {
                //     res = [res];
                // }
                //console.log(res);
                // console.log('1045');
                res = res['client'].data.user;
                //console.log(res);
                if (Array.isArray(res)) {
                    if (res.length) {
                        console.log('ERROR username exist');
                        js.client.data.message = 'ERROR username exist';
                        deferred.reject(js);
                    } else {
                        // console.log('OK username ');
                        try {
                            let gui = js.client.auth.gui;
                            js.client.data.user = user;
                            js.client.data.user.gui = uuidV4();
                            js.client.data.user.parents = ['ice-maker-admin'];
                            js.client.data.user.roles = ['user'];
                            js.client.data.user.system = ['ice-maker'];
                            // js.client.data.user.system.push('default');
                            // js.client.data.user.system.push('gij');
                            js.client.data.user.createddate = (moment().format()),
                                js.client.data.user.lastupdate = (moment().format()),
                                js.client.data.user.isactive = true;
                            // let u = js.client.data.user;
                            //console.log('adding sub user');
                            this.addSubUser(js).then(res => {
                                console.log('OK add sub user');
                                js.client.data.message = 'OK add sub-user';
                                deferred.resolve(js);
                            });
                        } catch (error) {
                            console.log(error);
                            console.log(error); deferred.reject(error);
                        }
                    }
                } else {
                    console.log('ERROR NOT AN ARRAY');
                    deferred.reject("ERROR NOT AN ARRAY");
                }
            }).catch(err => {
                { console.log(err); deferred.reject(err); }
            });
        } catch (error) {
            js.client.data.message = error;
            console.log(error);
            deferred.reject(js);
        }
        return deferred.promise;
    }
    register_sale_user_ws(js) {
        let deferred = Q.defer();
        let k = js.client.auth.gui;
        try {
            let user = JSON.parse(JSON.stringify(js.client.data.user));
            this.findUserByUsername(js).then(res => {
                // if (!Array.isArray(res)) {
                //     res = [res];
                // }
                res = res['client'].data.user;
                if (Array.isArray(res)) {
                    if (res.length) {
                        js.client.data.message = 'ERROR username exist';
                        deferred.reject(js);
                    } else {
                        let gui = js.client.auth.gui;
                        js.client.data.user = user;
                        js.client.data.user.gui = uuidV4();
                        js.client.data.user.parents = ['ice-maker-admin'];
                        js.client.data.user.roles = ['user', 'sale'];
                        js.client.data.user.system = ['ice-maker'];
                        // js.client.data.user.system.push('default');
                        // js.client.data.user.system.push('gij');
                        js.client.data.user.createddate = (moment().format()),
                            js.client.data.user.lastupdate = (moment().format()),
                            js.client.data.user.isactive = true;
                        // let u = js.client.data.user;
                        this.addSubUser(js).then(res => {
                            js.client.data.message = 'OK add sub-user';
                            deferred.resolve(js);
                        });
                    }
                }
            }).catch(err => {
                { console.log(err); deferred.reject(err); }
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }



    bulkRestoreParking(arr) {
        let deferred = Q.defer();
        let db = this.create_db('parking_record');
        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            }
            else {
                // console.log(arr.length);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    insertRestoreParking(arr) {
        let deferred = Q.defer();
        let db = this.create_db('parking_record');
        db.insert(arr, arr._id, (err, res) => {
            if (err) deferred.reject(err);
            else {
                console.log(arr.length);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    async updateParkingDoc(arr) {
        let deferred = Q.defer();
        let db = this.create_db('parking_record');
        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                console.log('bulk delete error');
                //console.log(err);
                deferred.reject(err);
            } else {
                console.log('bulk delete success');
                //console.log(res);
                deferred.resolve('OK');
            }
        });
        return deferred.promise;
    }
    async deleteAllParkingDoc() {
        let deferred = Q.defer();
        let dbname = 'parking_record';
        let db = this.create_db(dbname);
        console.log('destroy ' + dbname);
        let parent = this;
        this.nano.db.create(dbname, function (err, body) {
            if (err) {
                parent.nano.db.destroy(dbname, function (err, body) {
                    // create a new database
                    if (err) {
                        console.log(err);
                        deferred.reject(err);
                    }
                    else {
                        parent.nano.db.create(dbname, function (err, body) {
                            if (err) {
                                console.log(err);
                                deferred.reject(err);
                            }
                            else {
                                parent.init_db(dbname, parent.__design_parking);
                                deferred.resolve('OK recreate parking record')
                            }

                        });
                    }

                });
            } else {
                parent.nano.db.create(dbname, function (err, body) {
                    if (err) {
                        console.log(err);
                        parent.init_db(dbname, parent.__design_parking);
                        deferred.reject(err);
                    }
                    else {
                        parent.init_db(dbname, parent.__design_parking);
                        deferred.resolve('OK recreate ' + dbname)
                    }

                });
            }
        });

        return deferred.promise;
    }
    async restoreParkingBackupFile() {
        console.log('restoring parking');
        // let fname = __dirname + '../../../../ice_maker_parking_record.txt/ice_maker_parking_record.txt';
        let fname = path.resolve(__dirname, "../../../ice_maker_parking_record.txt/ice_maker_parking_record.txt");
        try {
            let arr = fs.readFileSync(fname).toString().split(/\n/);
            let ar = [];
            let count = 0;
            for (let index = 0; index < arr.length; index++) {
                if (typeof arr[index] == "undefined" || !arr[index]) {
                    // NOOP
                } else {
                    const element = JSON.parse(arr[index]);
                    for (let i = 0; i < element.length; i++) {
                        const e = element[i];
                        delete e._revisions;
                        delete e._rev;
                        // e.gui = e._id;
                        // e._id = e._id;
                        ar.push(e);
                    }
                    console.log(`parking ${index}/${arr.length}(${ar.length}) - ${count += ar.length}`);
                }
                if (ar.length >= 10 * 1000 || index + 1 >= arr.length) {
                    await this.bulkRestoreParking(ar);
                    console.log(` parking inserted: +${ar.length} total:${count}`);
                    ar.length = 0
                }

            }
            console.log('done restore parking');
            // console.log(ar.length);
            // await this.bulkRestoreWorking(ar);
        } catch (error) {
            console.log(error);
        }
    }
    bulkRestoreRaws(arr) {
        let deferred = Q.defer();
        let db = this.create_db('raws');
        console.log('beofre bulk restore raws');
        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            }
            else {
                console.log(arr.length);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    bulkRestoreWorking(arr) {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            }
            else {
                console.log(arr.length);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    insertRestoreWorking(arr) {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.insert(arr, arr._id, (err, res) => {
            if (err) deferred.reject(err);
            else {
                console.log(arr.length);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    updateWorkingDoc(arr) {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                console.log('bulk delete error');
                //console.log(err);
                deferred.reject(err);
            } else {
                console.log('bulk delete success');
                //console.log(res);
                deferred.resolve('OK');
            }
        });
        return deferred.promise;
    }
    deleteAllWorkingDoc() {
        let deferred = Q.defer();
        let dbname = 'working_record';
        let db = this.create_db(dbname);
        console.log('destroy ' + dbname);
        let parent = this;
        this.nano.db.create(dbname, function (err, body) {
            if (err) {
                parent.nano.db.destroy(dbname, function (err, body) {
                    // create a new database
                    if (err) {
                        console.log(err);
                        deferred.reject(err);
                    }
                    else {
                        parent.nano.db.create(dbname, function (err, body) {
                            if (err) {
                                console.log(err);
                                deferred.reject(err);
                            }
                            else {
                                parent.init_db(dbname, parent.__design_working);
                                deferred.resolve('OK recreate working record')
                            }

                        });
                    }

                });
            } else {
                parent.nano.db.create(dbname, function (err, body) {
                    if (err) {
                        console.log(err);
                        parent.init_db(dbname, parent.__design_working);
                        deferred.reject(err);
                    }
                    else {
                        parent.init_db(dbname, parent.__design_working);
                        deferred.resolve('OK recreate ' + dbname)
                    }

                });
            }
        });
        // db.list({ include_docs: true, limit: 100 }, async (err, body) => {
        //     if (err) console.log(err);
        //     if (!err) {
        //         let array = body.rows;
        //         let arr = [];
        //         let c = 0;
        //         console.log('fetching');
        //         for (let index = 0; index < array.length; index++) {
        //             const element = array[index];
        //             //console.log(element);
        //             if (element.id.indexOf('_design/objectList') > -1) {

        //             }
        //             else {
        //                 element.doc._deleted = true;
        //                 arr.push(element.doc);
        //             }
        //         }
        //         await this.updateWorkingDoc(arr);
        //         //console.log(array[0]);
        //         deferred.resolve('OK DELETE WORKING');
        //     } else
        //         console.log(err);
        //     deferred.reject(err);
        // });

        return deferred.promise;
    }
    backupDB() {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.list({}, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                console.log(res.rows.length);
                let arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].doc;
                    arr.push(element);
                }
                fs.writeFile('working_record.json', JSON.stringify(arr), { encoding: 'utf8', }, err => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });

    }
    readBackUp() {
        fs.readFile('working_record.json', 'utf8', async function readFileCallback(err, data) {
            if (err) {
                console.log(err);
            } else {
                let obj = JSON.parse(data); //now it an object
                let arr = [];
                for (let index = 0; index < obj.length; index++) {
                    const element = obj[index];
                    arr.push(element);
                    if (arr.length >= 10 * 1000 || index + 1 >= arr.length) {
                        await this.bulkRestoreWorking(arr);
                        console.log(`working inserted: +${index} total:${arr.length}`);
                        arr.length = 0;
                    }
                }
            }
        });
    }
    async restoreRawRecord() {
        console.log('Raws restoring');
        let c_db = 'raws';
        // let fname = __dirname + '../../../../ice_maker_raws.txt/ice_maker_raws.txt';
        let fname = path.resolve(__dirname, "../../../ice_maker_raws.txt/ice_maker_raws.txt");
        try {
            let arr = fs.readFileSync(fname).toString().split(/\n/);
            let ar = [];
            let count = 0;
            let total_fix = 0;
            for (let index = 0; index < arr.length; index++) {
                if (typeof arr[index] == "undefined" || !arr[index]) {
                    // NOOP
                } else {
                    const element = JSON.parse(arr[index]);
                    for (let i = 0; i < element.length; i++) {
                        const e = element[i];
                        delete e._rev;
                        delete e._revisions;
                        if (e.data)
                            ar.push(e);
                    }
                    console.log(`raws ${index}/${arr.length}(${ar.length}) - ${count += ar.length}`);

                }
                if (ar.length >= 10000 || index + 1 >= arr.length) {
                    let array = await this.checkBy_IDs(this.get_IDs(ar), c_db) as any;
                    console.log('after chec ID ' + array.length)
                    for (let index = 0; index < ar.length; index++) {
                        const element = ar[index];
                        if (array.indexOf(element._id) < 0) {
                            ar.splice(index, 1);
                        }
                    }
                    console.log(ar[0]);
                    await this.bulkRestoreRaws(ar);
                    console.log(`raws inserted: +${ar.length} total:${count}`);
                    ar.length = 0
                }

            }
            console.log('done restore raws');
            // console.log(ar.length);
            // await this.bulkRestoreWorking(ar);
        } catch (error) {
            console.log(error);
        }

    }
    async restoreWorkingRecord() {
        console.log('working restoring');
        let c_db = 'working_record';
        //let fname = '../../../../ice_maker_working_record.txt/ice_maker_working_record.txt';
        let fname = path.resolve(__dirname, "../../../ice_maker_working_record.txt/ice_maker_working_record.txt");
        //let fname = 'E:\\icemaker\\ice_maker_working_record.txt\\ice_maker_working_record.txt';
        try {
            let arr = fs.readFileSync(fname).toString().split(/\n/);
            let ar = [];
            let count = 0;
            let total_fix = 0;
            for (let index = 0; index < arr.length; index++) {
                if (typeof arr[index] == "undefined" || !arr[index]) {
                    // NOOP
                } else {
                    const element = JSON.parse(arr[index]);
                    for (let i = 0; i < element.length; i++) {
                        const e = element[i];
                        if (e['docs']) {
                            //console.log(e['docs'].length);
                            // console.log('found in docs ' + e.docs.length);
                            for (let i = 0; i < e.docs.length; i++) {
                                const x = e.docs[i];
                                delete x._revisions;
                                delete x._rev;
                                total_fix++;
                                // e._id ? x.gui = e._id : e._id = x.gui;
                                // x._id = x.gui;
                                if ((x.gpstime + '').indexOf('+07:00') > -1) {
                                    x.gpstime = (x.gpstime + '').replace('+07:00', '');
                                    x.servertime = (x.servertime + '').replace('+07:00', '');
                                    // let clone_x=JSON.parse(JSON.stringify(x));
                                    // clone_x.gui=uuidV4();
                                    // clone_x._id=x.gui;
                                    // ar.push(x);
                                    // x._deleted=true;
                                }
                                ar.push(x);
                            }
                            // await function(){ return new Promise(resolve => setTimeout(resolve, 1000));};
                        } else {
                            delete e._revisions;
                            delete e._rev;
                            // e.gui = e._id;
                            // e._id = e._id;
                            if ((e.gpstime + '').indexOf('+07:00') > -1) {
                                e.gpstime = (e.gpstime + '').replace('+07:00', '');
                                e.servertime = (e.servertime + '').replace('+07:00', '');
                            }
                            ar.push(e);
                        }

                    }
                    console.log(`working ${index}/${arr.length}(${ar.length}) - ${count += ar.length}`);
                    console.log('total fix ' + total_fix);
                }
                if (ar.length >= 10 * 1000 || index + 1 >= arr.length) {
                    // let array = await this.checkBy_IDs(this.get_IDs(ar), c_db) as any;
                    // for (let index = 0; index < ar.length; index++) {
                    //     const element = ar[index];
                    //     if (array.indexOf(element._id) < 0) {
                    //         ar.splice(index, 1);
                    //     }
                    // }
                    await this.bulkRestoreWorking(ar);
                    console.log(`working inserted: +${ar.length} total:${count}`);
                    ar.length = 0
                }

            }
            console.log('done restore working');
            // console.log(ar.length);
            // await this.bulkRestoreWorking(ar);
        } catch (error) {
            console.log(error);
        }

    }

    async restoreWorkingBackupFile() {
        console.log('working restoring');
        let c_db = 'working_record';
        // let fname = __dirname + '../../../../ice_maker_working_record.txt/ice_maker_working_record.txt';
        let fname = path.resolve(__dirname, "../../../ice_maker_working_record.txt/ice_maker_working_record.txt");
        try {
            let arr = fs.readFileSync(fname).toString().split(/\n/);
            let ar = [];
            let count = 0;
            let total_fix = 0;
            for (let index = 0; index < arr.length; index++) {
                if (typeof arr[index] == "undefined" || !arr[index]) {
                    // NOOP
                } else {
                    const element = JSON.parse(arr[index]);
                    for (let i = 0; i < element.length; i++) {
                        const e = element[i];

                        delete e._revisions;
                        delete e._rev;
                        // e.gui = e._id;
                        // e._id = e._id;
                        ar.push(e);
                    }
                    console.log(`working ${index}/${arr.length}(${ar.length}) - ${count += ar.length}`);
                    console.log('total fix ' + total_fix);
                }
                if (ar.length >= 10 * 1000 || index + 1 >= arr.length) {
                    await this.bulkRestoreWorking(ar);
                    console.log(`working inserted: +${ar.length} total:${count}`);
                    ar.length = 0
                }

            }
            console.log('done restore working');
            // console.log(ar.length);
            // await this.bulkRestoreWorking(ar);
        } catch (error) {
            console.log(error);
        }

    }
    getRecordCount(dbname) {
        let deferred = Q.defer();
        let db = this.create_db(dbname);
        db.list({ limit: 0 }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err)
            } else {
                deferred.resolve(res.total_rows);
            }
        });
        return deferred.promise;
    }
    getRecordList(dbname, page, maxpage) {
        let deferred = Q.defer();
        let db = this.create_db(dbname);
        console.log('paging: ', dbname, page, maxpage);
        db.list({ limit: maxpage, skip: page, include_docs: true }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err)
            } else {
                let arr = [];
                let array = res.rows;
                for (let index = 0; index < array.length; index++) {
                    const element = array[index].doc;
                    // console.log(element);
                    if (element.docs) {
                        element.docs[0]._id = element._id;
                        element.docs[0].gui = element._id
                        element.docs[0]._rev = element._rev;
                        // element=JSON.parse(JSON.stringify(element.docs[0]));
                        arr.push(element.docs[0]);
                    } else {
                        arr.push(element);
                    }

                }
                deferred.resolve(arr);
            }
        })
        return deferred.promise;
    }
    updateBulkDoc(arr, dbname) {
        let deferred = Q.defer();
        let db = this.create_db(dbname);
        console.log('updating');

        db.bulk({ docs: arr }, (err, res) => {
            if (err) {
                //console.log('bulk update error');
                console.log(err);
                deferred.reject(err);
            } else {
                console.log(res);
                console.log('bulk update success');
                //console.log(res);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    getBy_ID(_id, dbname) {
        let deferred = Q.defer();
        let db = this.create_db(dbname);
        console.log('getting');
        // console.log(arr);
        db.get(_id, (err, res) => {
            if (err) {
                //console.log('bulk update error');
                console.log(err);
                deferred.reject(err);
            } else {
                //console.log(res);
                //console.log(`get: ${res}`);
                //console.log(res);
                deferred.resolve(res);
            }
        });
        return deferred.promise;
    }
    get_IDs(array) {
        let ids = [];
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            ids.push(element._id);
        }
        return ids;
    }
    checkBy_IDs(_id, dbname) {
        let deferred = Q.defer();
        let db = this.create_db(dbname);
        console.log('getting');
        if (!Array.isArray(_id)) {
            _id = [_id];
        }
        // console.log(arr);
        db.fetch({ keys: _id }, (err, res) => {
            if (err) {
                //console.log('bulk update error');
                console.log(err);
                deferred.reject(err);
            } else {
                //console.log(res);
                //console.log(`get: ${res.rows}`);
                //console.log(res);
                let arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].id;
                    if (element)
                        arr.push(element);
                }

                deferred.resolve(arr);
            }
        });
        // db.view(this.__design_view, 'by_id', { keys: [_id] }, (err, res) => {
        //     if (err) {
        //         //console.log('bulk update error');
        //         console.log(err);
        //         deferred.reject(err);
        //     } else {
        //         //console.log(res);
        //         //console.log(`get: ${res.rows}`);
        //         //console.log(res);
        //         let arr = [];
        //         for (let index = 0; index < res.rows.length; index++) {
        //             const element = res.rows[index].id;
        //             arr.push(element);
        //         }
        //         deferred.resolve(arr);
        //     }
        // });
        return deferred.promise;
    }
    getRawGen(page, maxpage) {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        console.log('listing');
        db.list({ limit: maxpage, skip: page, include_docs: true }, async (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                let arr = [];
                let empty_arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index];
                    if (element.doc)
                        arr.push(element.doc);

                }
                if (empty_arr.length) {
                    console.log('DELETE BULK DOC RAWS');
                    await this.updateBulkDoc(empty_arr, 'raws');
                }
                deferred.resolve(arr);
            }
        });
        return deferred.promise;
    }
    getRawGenCount() {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        db.list({ limit: 0 }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                deferred.resolve(res.total_rows);
            }
        });
        return deferred.promise;
    }
    getRawCount() {
        let deferred = Q.defer();
        let db = this.create_db('raws');
        db.list({ limit: 0 }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                deferred.resolve(res.total_rows);
            }
        });
        return deferred.promise;
    }
    getRaws(page, maxpage) {
        let deferred = Q.defer();
        let db = this.create_db('raws');
        console.log('listing');
        db.list({ limit: maxpage, skip: page, include_docs: true }, async (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                let arr = [];
                let empty_arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index];
                    if (element.doc.data)
                        arr.push(element.doc.data);
                    else {
                        element.doc._deleted = true;
                        empty_arr.push(element.doc);
                    }
                }
                if (empty_arr.length) {
                    console.log('DELETE BULK DOC RAWS');
                    await this.updateBulkDoc(empty_arr, 'raws');
                }
                deferred.resolve(arr);
            }
        });
        return deferred.promise;
    }
    floatval(mixedVar) {
        //  discuss at: http://locutus.io/php/floatval/
        // original by: Michael White (http://getsprink.com)
        //      note 1: The native parseFloat() method of JavaScript returns NaN
        //      note 1: when it encounters a string before an int or float value.
        //   example 1: floatval('150.03_page-section')
        //   returns 1: 150.03
        //   example 2: floatval('page: 3')
        //   example 2: floatval('-50 + 8')
        //   returns 2: 0
        //   returns 2: -50

        return (parseFloat(mixedVar) || 0)
    }
    hexdec(hexString) {
        //  discuss at: http://locutus.io/php/hexdec/
        // original by: Philippe Baumann
        //   example 1: hexdec('that')
        //   returns 1: 10
        //   example 2: hexdec('a0')
        //   returns 2: 160

        hexString = (hexString + '').replace(/[^a-f0-9]/gi, '')
        return parseInt(hexString, 16)
    }
    number_format(number, decimals, dec_point = undefined, thousands_sep = undefined) {
        // Strip all characters but numerical ones.
        number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
        var n = !isFinite(+number) ? 0 : +number,
            prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
            sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
            dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
            s = [],
            toFixedFix = function (n, prec) {
                var k = Math.pow(10, prec);
                return '' + Math.round(n * k) / k;
            };
        // Fix for IE parseFloat(0.55).toFixed(0) = 0;
        s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
        if (s[0].length > 3) {
            s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
        }
        if ((s[1] || '').length < prec) {
            s[1] = s[1] || '';
            s[1] += new Array(prec - s[1].length + 1).join('0');
        }
        return s.join(dec);
    }
    deg_to_decimal(deg) {

        if (deg == '')
            return 0.000000;

        let sign = deg.substr(-1);

        if (sign.toUpperCase() == "N" || sign.toUpperCase() == "E")
            sign = 1;
        else if (sign.toUpperCase() == "W" || sign.toUpperCase() == "S")
            sign = -1;

        deg = deg.substr(0, deg.length - 1);
        //console.log("deg:"+deg);
        // $deg = floatval($deg);
        //
        let degree = deg.substr(0, deg.length - 7);
        let decimal = deg.substr(-7);
        //console.log('degree %s',degree);
        //console.log('dec %s',decimal);
        //echo "Degree : $degree, Decimal : $decimal";

        //echo "$sign * number_format(floatval((($degree * 1.0) + ($deg/60))),6);";
        let n = (degree * 1.0) + (decimal / 60);
        //console.log('n:'+n);
        //console.log(n);
        decimal = sign * Number.parseFloat(this.number_format(this.floatval((n)), 6));

        return decimal;
    }
    str_split(string, splitLength): Array<any> { // eslint-disable-line camelcase
        //  discuss at: http://locutus.io/php/str_split/
        // original by: Martijn Wieringa
        // improved by: Brett Zamir (http://brett-zamir.me)
        // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
        //  revised by: Theriault (https://github.com/Theriault)
        //  revised by: Rafał Kukawski (http://blog.kukawski.pl)
        //    input by: Bjorn Roesbeke (http://www.bjornroesbeke.be/)
        //   example 1: str_split('Hello Friend', 3)
        //   returns 1: ['Hel', 'lo ', 'Fri', 'end']

        if (splitLength === null) {
            splitLength = 1
        }
        if (string === null || splitLength < 1) {
            return []
        }

        string += ''
        var chunks = []
        var pos = 0
        var len = string.length

        while (pos < len) {
            chunks.push(string.slice(pos, pos += splitLength))
        }

        return chunks
    }
    isDate(date) {
        let parsedDate = Date.parse(date);
        return (isNaN(date) && !isNaN(parsedDate));
    }
    rawToJson(raw) {
        //data='(027029926607BR00180213A1759.4902N10237.1968E000.0063422000.0000000001L00000000)'; 
        let array = raw;
        let d = [];
        let jsd: any = [];
        for (let index = 0; index < array.length; index++) {
            const rawdata = array[index];
            if (!rawdata) continue;
            //console.log('RAW TO JSON');
            //  console.log(data);

            try {
                let _response = "COMM";
                let _G = 0;
                let _ACC = 0;
                let _isLatest = 0;
                let _gpioStr = '';
                let working_data = [];
                let parking_data = [];
                let alarm_data = [];
                let latest_data = [];
                if (rawdata == '') {
                    continue
                }
                if (rawdata.length < 13) {
                    continue;
                }
                //console.log("count data:" + data.split(')').length);
                let dx = [];
                rawdata.split(')').forEach(element => {
                    dx.push(element + ")");
                });
                for (let index = 0; index < dx.length; index++) {
                    _response += ' ';
                    let data = dx[index];
                    // console.log('==>'+data);
                    if (data.length < 13)
                        break;
                    let _msgType = data.substring(13, 13 + 4);
                    let _device = data.substring(1, 1 + 12);
                    let _eventCode = '';
                    // console.log(_msgType);
                    // console.log(_device);
                    if (_msgType == "BP00") //Shake hand and need to response
                    {
                        continue;
                    } else if (_msgType == "BP05" || _msgType == "BR03") { //login message need to response
                        continue;
                    } else if (_msgType == "BS08") { //get response continue message sending data from tracker only 
                        _isLatest = 1;
                    } else if (_msgType == "BO01") {
                        _eventCode = data.substring(17, 17 + 1); //s.substring(17,18);
                        //_response=sprintf("%sAS01%s",_device,_r);

                        _G = 18;

                        _response = util.format("%sAS01%s", _device, 0) + ' ';
                        _isLatest = 1;
                    } else if (_msgType == "BP04") { // Answer to Message of calling the roll.
                        _G = 17;
                        _isLatest = 1;
                    } else if (_msgType == "AP19") {
                        continue;
                    } else if (_msgType == "BR00" || _msgType.indexOf("BZ00") == 0) { //message of tracker sent by specific interval by user

                        if (_msgType == "BR00") {
                            _G = 17;
                            if (data.length < _G + 45 + 8) {
                                //console.log(data);
                                data = data.slice(0, data.lastIndexOf(')'));
                                data += "0000L00000000)";
                                //console.log(data);
                            }
                        } else { //when no GPS which handle later 
                            _response = "" + _device + "BZ00 ";
                        }
                        _isLatest = 1;
                    } else if (_msgType == "BP12") { // Response to set up vehicle max and min speed

                        _isLatest = 1;
                    } else if (_msgType == "BV00") { //Response to circuit Control
                        continue;
                    } else if (_msgType == "BV01") { //Response to oil Control
                        continue;
                    } else if (_msgType == "BR01" || _msgType == "BZ01") {
                        if (_msgType == "BR01") {
                            _G = 17;
                            if (data.length < _G + 45 + 8) {
                                //console.log(data);
                                data = data.slice(0, data.lastIndexOf(')'));
                                data += "0000L00000000)";
                                //console.log(data);
                            }
                        } else {
                            //when no GPS which handle later , handle later
                            _response = util.format(" %sBZ01", _device) + ' ';
                            //writeLog("OK _response _device _ACC /_input");
                            //die(sprintf(" OK %s", _response));
                        }
                        _isLatest = 0;
                    } else {
                        //writeLog("OK _response _device _ACC /_input");
                        //die(sprintf(" OK %s", _arr_input_data[_iLoop]));
                        continue;
                    }
                    // if(data.length<_G + 45){
                    // continue;}
                    // if(data.length<_G + 45+8){
                    //     _gpioStr = data.substring(_G + 45, _G + 45 + 4)
                    // }else{

                    // }
                    _gpioStr = data.substring(_G + 45, _G + 45 + 8);
                    if (_msgType.indexOf('BZ0') == 0) {
                        let arr = data.split(',');
                        _gpioStr = arr[arr.length - 1];
                    }
                    let status: any = {};
                    //status.gui=uuidV4();
                    //status.imei = _device;
                    //status.messagetype = _msgType;
                    status.eventcode = _eventCode;
                    status.voltage = 0;
                    //status.gpsvalidity='V';
                    status.input = [];
                    status.output = [];
                    status.custom = {};
                    status.runtime = 0;
                    //status.speed=0;
                    //status.odometer=0;
                    status.gpsvalue = 0;
                    status.gsmvalue = 0;
                    if (_gpioStr.length >= 8) {
                        //10000000 
                        let _gpioStrArr = _gpioStr.split('');
                        status.mainpower = _gpioStrArr[0]; //old style start from 1 05092016
                        // Writelog(_MainPower +' '+ _gpioStr +' '+ _device +' '+ _gpioStrArr[2]);            
                        status.acc = _gpioStrArr[1];
                        status.ignition = (status.acc == "1") ? 'ON' : 'OFF';


                        status.blender = _gpioStrArr[2];
                        status.emptyheavy = _gpioStrArr[3];
                        status.frontdoor = _gpioStrArr[4];
                        status.backdoor = _gpioStrArr[5]; //off the oil ?
                        status.offtheoil = _gpioStrArr[5];
                        status.putback = _gpioStrArr[6]; //arm disarm
                        status.disarm = _gpioStrArr[6]; //arm disarm
                        status.vibration = _gpioStrArr[7]; //vibration

                    }
                    var deviceinfo: any = {
                        gui: uuidV4(),
                        imei: _device,
                        protocol: 'keson',
                        messagetype: _msgType,
                        gpsvalidity: "V",
                        gpstime: '',
                        servertime: (moment().format()),
                        lat: 0,
                        lon: 0,
                        alt: 0,
                        speed: 0,
                        heading: 0,
                        alarmtype: '',
                        odometer: 0,
                        odometerunit: '',
                        runtime: 0,
                        //speed: 0,
                        statuscode: [],
                        status: {},
                        islatest: _isLatest
                    };
                    deviceinfo._id = deviceinfo.gui;
                    var [_year, _month, _date] = this.str_split(data.substring(_G + 0, _G + 0 + 6), 2);
                    var [_hour, _minute, _second] = this.str_split(data.substring(_G + 33, _G + 33 + 6), 2);


                    deviceinfo.gpstime = moment.utc(util.format("20%s-%s-%s %s:%s:%s", _year, _month, _date, _hour, _minute, _second), 'YYYY-MM-DD HH:mm:ss');
                    // deviceinfo.gpstime =new Date(20+_year,_month,_date,_hour,_minute,_second);
                    // console.log('gpstime: '+deviceinfo.gpstime);
                    // deviceinfo.gpstime = (deviceinfo.gpstime);
                    deviceinfo.gpstime = this.convertTZ(deviceinfo.gpstime);
                    if (!this.isDate(deviceinfo.gpstime.toString())) {
                        // console.log(deviceinfo.gpstime);
                        //console.log('Ignore wrong time');
                        continue;
                    }

                    //console.log('+7 gpstime:'+deviceinfo.gpstime);
                    if (_msgType.indexOf('BZ0') == 0)
                        deviceinfo.gpstime = (moment().format());
                    //console.log('gpstime '+deviceinfo.gpstime);  
                    let _secondsDiff = moment(deviceinfo.servertime, "YYYY-MM-DD HH:mm:ss").diff(moment(deviceinfo.gpstime, "YYYY-MM-DD HH:mm:ss"));

                    // console.log(deviceinfo.gpstime);
                    //console.log(deviceinfo.servertime);
                    //console.log('second diff: '+_secondsDiff);
                    if (_secondsDiff < 0)
                        deviceinfo.gpstime = deviceinfo.servertime;

                    // console.log('gpstime:'+deviceinfo.gpstime);

                    if (_msgType.indexOf('BZ0') != 0) {
                        deviceinfo.gpsvalidity = data.substring(_G + 6, _G + 6 + 1);
                        deviceinfo.lat = this.deg_to_decimal(data.substring(_G + 7, _G + 7 + 10));
                        // console.log(deviceinfo.lat);
                        //(013632891762 BP050 00013632891762130918 A 2217.7724N0 7047.1436E 000.0 130023 297.45 00000000 L 00000000)
                        //(027029926607 BR00 180213 A 1759.4857N 10237.2001E 000.0 200354 000.00 00000000 L 00000000)
                        //(027029926607 BR00 180509 A 1759.4896N 10237.2006E 000.0 134224 000.00 0100)
                        //(027029657210 BR01 180513 A 1759.9117N 10235.5718E 002.6 085514 002.94 00000000 L 00000000)
                        //(027029926607 BR00 180509 A 1759.4896N 10237.2006E 000.0 134224 000.00 01000000 L 00000000)
                        deviceinfo.lon = this.deg_to_decimal(data.substring(_G + 17, _G + 17 + 11));
                        deviceinfo.speed = data.substring(_G + 28, _G + 28 + 5);
                        //deviceinfo._timeStr = data.substring( _G + 33,_G+33+ 6);
                        //put ignition here 
                        deviceinfo.heading = data.substring(_G + 39, _G + 39 + 6);
                        deviceinfo.odometerunit = data.substring(_G + 53, _G + 53 + 1);
                        deviceinfo.odometer = this.hexdec(data.substring(_G + 54, _G + 54 + 8));
                        //deviceinfo.eventcode .length=0;
                        //deviceinfo.eventcode.push(_eventCode);
                        if (deviceinfo.odometer > 0) {
                            deviceinfo.odometer = (deviceinfo.odometer / 1000);
                            deviceinfo.odometerflag = true;
                        }
                    }
                    let _statusCode = "STATUS_LOCATION";
                    if (_eventCode) {
                        // 0=PowerOff, 1=Arrive, 2=SOS, 3=AntiTheft, 4=LowerSpeed?, 5=Overspeed, 6=Depart
                        switch (_eventCode) {
                            case '0':
                                _statusCode = "STATUS_POWER_OFF";
                                break;
                            case '1':
                                _statusCode = "STATUS_GEOBOUNDS_ENTER";
                                break;
                            case '2':
                                _statusCode = "STATUS_PANIC_ON";
                                break;
                            case '3':
                                _statusCode = "STATUS_INTRUSION_ON";
                                break;
                            case '4':
                                _statusCode = "STATUS_LOCATION";
                                break;
                            case '5':
                                _statusCode = "STATUS_MOTION_EXCESS_SPEED";
                                break;
                            case '6':
                                _statusCode = "STATUS_GEOBOUNDS_EXIT";
                                break;
                            case '7':
                                _statusCode = "STATUS_MOVEMENT";
                                break;
                            case '8':
                                _statusCode = "STATUS_LOW_POWER";
                                break;
                        }
                    }
                    //deviceinfo.statuscode.length = 0;
                    deviceinfo.acc = status.acc;
                    //status.agps.length = 0;
                    if (deviceinfo.gpsvalidity === 'V')
                        deviceinfo.statuscode.push('INVALID_GPS');
                    else if (_msgType.indexOf('BZ0') == 0)
                        deviceinfo.statuscode.push('LBS');
                    if (deviceinfo.vibration)
                        deviceinfo.statuscode.push('VIBRATION');

                    deviceinfo.status = status;
                    d.push(deviceinfo);
                    jsd.push({ raw: data, data: deviceinfo });
                }

            } catch (error) {
                console.log(error);
                continue;
            }
        }

        return jsd;
    }
    async generateRaws() {
        let deferred = Q.defer();
        let count = await this.getRawCount() as string;
        let page = 0;
        let maxpage = 50000;
        let range = Math.ceil(Number.parseInt(count) / maxpage);
        try {
            for (let index = 0; index < range; index++) {
                page = index * maxpage;
                let raw = await this.getRaws(page, maxpage) as Array<any>;
                let jsraw = this.rawToJson(raw);
                let arr = [];
                for (let index = 0; index < jsraw.length; index++) {
                    if (jsraw[index].data)
                        arr.push(jsraw[index].data);
                }
                let res = await this.updateBulkDoc(arr, 'raws_gen') as Array<any>;
                console.log(res.length);
            }
            deferred.resolve('GEN OK');
        } catch (error) {
            console.log(error);
            deferred.reject(error);
        }

        return deferred.promise;
    }
    searchRawsGenByGPSTIMELATLON(arr) {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        console.log('search range ' + arr.length);
        console.log('search range ' + arr[0]);
        db.view(this.__design_view, 'searchByGPSTIMELATLON', { keys: arr, include_docs: true }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                let arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].doc;
                    arr.push(element);
                }
                // console.log(arr);
                // throw new Error('TEST');
                // @ts-ignore
                deferred.resolve(arr);
            }
        })
        return deferred.promise;
    }
    async fixWithRaws(ar) {
        let deferred = Q.defer();
        //let db=this.create_db('raws_gen');
        // let count = await this.getRawGenCount() as string;
        // let page = 0;
        // let maxpage = 10000;
        // let range = Math.ceil(Number.parseInt(count) / maxpage);
        let fixarr = [];
        // for (let index = 0; index < range; index++) {
        //     page = index * maxpage;
        // let jsraw = await this.getRawGen(page, maxpage) as Array<any>;
        // console.log(jsraw.length);
        // console.log(new Date(jsraw[500].gpstime).getTime());
        // console.log(' VS ');
        // console.log(new Date(ar[500].gpstime).getTime());          
        // throw new Error('TESTING');
        //         // @ts-ignore
        let fixAcc = [];
        let fixImei = [];
        let searcharrimei = [];
        let searcharracc = [];

        for (let index = 0; index < ar.length; index++) {
            try {
                const element = ar[index];
                if (!element.imei) {
                    searcharrimei.push([moment(element.gpstime).valueOf(), Number.parseFloat(element.lat), Number.parseFloat(element.lon)]);
                }
                else if (!element.acc) {
                    searcharracc.push([moment(element.gpstime).valueOf(), Number.parseFloat(element.lat), Number.parseFloat(element.lon)]);
                }
            } catch (error) {
                console.log(error);
                continue;
            }

        }
        //let array = jsraw;
        // for (let i = 0; i < jsraw.length; i++) {
        //     const e = jsraw[i];
        try {
            if (searcharrimei.length) {
                // searcharrimei.length=0;
                // searcharrimei.push([1518430094000,17.99147,102.619992]);
                // console.log(e);
                // console.log(element); 
                // console.log('IMEI');   
                // if(new Date(e.gpstime).getTime() === new Date(element.gpstime).getTime() && e.lat === element.lat && e.lon === element.lon ){
                //     ar[index].imei = e.imei;
                //     //fixImei.push({fix:ar[index],data:JSON.stringify(e)});
                //     fixarr.push(ar[index]);
                // }
                //console.log('BAD DOC '+e.data.imei+' '+e.data.gpstime+' ACC '+e.data.acc );                       
                //throw new Error('TESTING');
                //   console.log(searcharrimei);
                console.log('search empty imei: ' + searcharrimei.length);
                fixImei = await this.searchRawsGenByGPSTIMELATLON(searcharrimei) as Array<any>;
                fixarr = fixarr.concat(fixImei);
                searcharrimei.length = 0;
                // @ts-ignore
            } else if (searcharracc.length) {
                console.log('search empty imei: ' + searcharracc.length);
                fixAcc = await this.searchRawsGenByGPSTIMELATLON(searcharracc) as Array<any>;
                fixarr = fixarr.concat(fixAcc);
                searcharracc.length = 0;
                // console.log(e);
                // console.log(element);
                // console.log('ACC');
                // if(new Date(e.gpstime).getTime() === new Date(element.gpstime).getTime() && e.lat === element.lat && e.lon === element.lon){                            

                //     ar[index].acc = e.acc;    
                //     //fixAcc.push({fix:ar[index],data:JSON.stringify(e)});                    
                //     fixarr.push(ar[index]);
                // }
                // console.log('BAD DOC '+e.data.imei+' '+e.data.gpstime +' ACC '+e.data.acc );

                // @ts-ignore
            }
            // console.log('fixacc '+fixAcc.length);
            // console.log(fixAcc);
            // console.log('fiximei '+fixImei.length);
            // console.log(fixImei);
        } catch (error) {
            console.log(error);
        }


        //}
        // }
        console.log('fixacc ' + fixAcc.length);
        console.log(fixAcc);
        console.log('fiximei ' + fixImei.length);
        console.log(fixImei);
        //throw new Error('TESTING');
        // // @ts-ignore
        //}
        deferred.resolve(fixarr);
        return deferred.promise;
    }
    async insertFromRawGen(y, m) {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        try {
            let count = await this.getCountRawGenByYEARMONTH(y, m) as number;
            console.log('COUNT ' + count);
            if (count > 0) {
                let page = 0;
                let maxpage = 10000;
                let range = Math.ceil(count / maxpage);
                let arr = [];
                for (let index = 0; index < range; index++) {
                    page = index * maxpage;
                    arr = await this.getRawGenByYEARMONTH(y, m, page, maxpage) as any[];
                    console.log('MANUAL INSERT BULK ' + arr.length);
                    //console.log(arr[0]);
                    let ar = await this.updateBulkDoc(arr, 'working_record');
                }
                deferred.resolve('OK');

            }
        } catch (error) {
            console.log(error);
        }

        return deferred.promise;
    }
    getCountRawGenByYEARMONTH(y, m) {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        db.view(this.__design_view, 'countByYEARMONTH', { key: [y, m] }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                let arr = [];
                console.log(res.rows[0].value);
                deferred.resolve(res.rows[0].value);
            }
        });
        return deferred.promise;
    }
    getRawGenByYEARMONTH(y, m, page, maxpage) {
        let deferred = Q.defer();
        let db = this.create_db('raws_gen');
        console.log('y%s, m%s , page%s , maxpage %s', y, m, page, maxpage);
        db.view(this.__design_view, 'findByYEARMONTH', { key: [y, m], include_docs: true, limit: maxpage, skip: page }, (err, res) => {
            if (err) {
                console.log(err);
                deferred.reject(err);
            } else {
                let arr = [];
                //console.log('RES: ',res);
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].doc;
                    delete element._rev;
                    arr.push(element);
                }
                deferred.resolve(arr);
            }
        });
        return deferred.promise;
    }
    fixDB() {
        let deferred = Q.defer();
        let c_db = 'working_record';
        this.getRecordCount(c_db).then(async res => {
            let count = res as number;
            console.log(count);
            let page = 0;
            let maxpage = 35000;
            let range = Math.ceil(count / maxpage);
            let total_fixed = 0;
            try {
                //let ar = [];
                for (let index = 0; index < range; index++) {
                    page = index * maxpage;
                    console.log(`page: ${page}`);
                    let ar = await this.getRecordList(c_db, page, maxpage) as any[];
                    console.log(`ar :${ar.length}`);

                    //console.log(arrw.length);
                    // for (let index = 0; index < arrw.length; index++) {
                    //     const e = arrw[index];
                    //     ar.push(e);
                    // }
                    // if (ar.length) {
                    //     ar = await this.fixWithRaws(ar) as Array<any>;
                    //     // throw new Error('ERROR TESTING');
                    //     // // @ts-ignore
                    //     if (ar.length) {
                    //         let res = await this.updateBulkDoc(ar, c_db) as Array<any>;
                    //         total_fixed += res.length;
                    //         ar.length = 0;
                    //     };

                    // }
                    let need = [];
                    // let test_id = '01f47d1c-d5e1-4482-9032-440d9479a8e3';
                    //let l="2018-06-10T15:05:03".length;
                    let found = 0;
                    for (let index = 0; index < ar.length; index++) {
                        // if((ar[index].gpstime+'').length>l){
                        //     console.log('FOUND',ar[index]);
                        // }
                        // console.log('',ar[index].gpstime ,ar[index].servertime,ar[index].imei,ar[index]._id);
                        // if ((ar[index]._id == '025c59d4-3d1d-48a4-86f0-8c9597a29a7b')) {
                        //     console.log('FOUND', ar[index]);
                        //    // process.exit();                            
                        //     //throw new Error('FOUND ');

                        // }                        
                        // continue;
                        // // // @ts-ignore
                        if ((ar[index].gpstime + '').indexOf('+07:00') > -1) {
                            found++;
                            //console.log('REPLACING');
                            ar[index].gpstime = (ar[index].gpstime + '').replace('+07:00', '');
                            ar[index].servertime = (ar[index].servertime + '').replace('+07:00', '');
                            need.push(ar[index]);
                        }
                        // if (ar[index]._id === test_id) {
                        //     need.push(ar[index]);
                        //     console.log("FOUND TEST ID ", test_id);
                        // }
                    }
                    console.log("FOUND FOR REPLACING ", found);
                    if (need.length) {
                        let res = await this.updateBulkDoc(need, c_db) as Array<any>;
                        total_fixed += res.length;
                        //console.log(res);
                        console.log(`${c_db} fixing ${total_fixed} records`);
                        for (let index = 0; index < res.length; index++) {
                            const element = res[index];
                            if (!element.ok) {
                                console.log(element);
                                throw new Error('ERROR NOT OK ');
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(error);
                deferred.reject(error);
            }
            c_db = 'parking_record';
            this.getRecordCount(c_db).then(async res => {
                let count = res as number;
                let page = 0;
                let maxpage = 10000;
                let range = Math.ceil(count / maxpage);
                let total_fixed = 0;
                try {
                    //let ar = [];
                    for (let index = 0; index < range; index++) {
                        page = index * maxpage;
                        console.log(`page: ${page}`);
                        let ar = await this.getRecordList(c_db, page, maxpage) as any[];
                        //console.log(arrw.length);
                        // for (let index = 0; index < arrw.length; index++) {
                        //     const e = arrw[index];
                        //     ar.push(e);
                        // }
                        // if (ar.length) {
                        //     ar = await this.fixWithRaws(ar) as Array<any>;
                        //     // throw new Error('ERROR TESTING');
                        //     // // @ts-ignore
                        //     if (ar.length) {
                        //         let res = await this.updateBulkDoc(ar, c_db) as Array<any>;
                        //         total_fixed += res.length;
                        //         ar.length = 0;
                        //     };

                        // }
                        let need = [];
                        let found = 0;
                        for (let index = 0; index < ar.length; index++) {

                            if ((ar[index].gpstime + '').indexOf('+07:00') > -1) {
                                found++;
                                console.log('REPLACING');
                                ar[index].gpstime = (ar[index].gpstime + '').replace('+07:00', '');
                                ar[index].servertime = (ar[index].servertime + '').replace('+07:00', '');
                                need.push(ar[index]);
                            }
                        }
                        console.log("FOUND FOR REPLACING ", found);
                        if (need.length) {
                            let res = await this.updateBulkDoc(need, c_db) as Array<any>;
                            total_fixed += res.length;
                            console.log(res);
                            console.log(`${c_db} fixing ${total_fixed} records`);
                            for (let index = 0; index < res.length; index++) {
                                const element = res[index];
                                if (!element.ok) {
                                    console.log(element);
                                    throw new Error('ERROR NOT OK ');
                                }

                            }
                        }
                    }


                } catch (error) {
                    console.log(error);
                    deferred.reject(error);
                }
            });
            deferred.resolve(total_fixed);
        });


        return deferred.promise;
    }
    get_device_list_by_owner_ws(js) {
        console.log('checking key');
        let deferred = Q.defer();
        console.log('checking key2');
        // console.log(js);
        let username = js.client.data.user.username;
        console.log('check key 3');
        this.findDeviceByUsername(username).then(res => {
            js.client.data.deviceinfo = res;

            //this.filterObject(js.client.data.deviceinfo);
            console.log('device list');
            console.log(res);
            js.client.data.message = 'OK get devices';
            deferred.resolve(js);
        }).catch(err => {
            js.client.data.message = err;
            deferred.reject(js);
        })
        return deferred.promise;
    }


    get_device_list_ws(js) {
        let deferred = Q.defer();
        let username = js.client.username;
        console.log('check key');
        this.findDeviceByUsername(username).then(res => {
            js.client.data.deviceinfo = res;
            //this.filterObject(js.client.data.deviceinfo);
            console.log('device list');
            console.log(res);
            js.client.data.message = 'OK get devices';
            deferred.resolve(js);
        }).catch(err => {
            js.client.data.message = err;
            deferred.reject(js);
        })
        return deferred.promise;
    }

    filterObject(obj) {
        var need = ['gui', '_rev', 'gui', 'password', 'oldphone', 'system', 'parents', 'roles', 'isActive'];
        // var need = [ '_rev', 'gui', 'password', 'oldphone', 'system'];
        //console.log(key);
        for (var i in obj) {
            //if(i==='password')
            //console.log(obj[i]);
            for (let x = 0; x < need.length; x++) {
                let k = need[x];
                if (!obj.hasOwnProperty(i)) { } else if (Array.isArray(obj[i])) {
                    if (i.toLowerCase().indexOf(k) > -1)
                        obj[i].length = 0;
                } else if (typeof obj[i] === 'object') {
                    this.filterObject(obj[i]);
                } else if (i.indexOf(k) > -1) {
                    obj[i] = '';
                }
            }
        }
        return obj;
    }

    get_problem_record(imei, y, m, d) {
        let deferred = Q.defer();
        let db = this.create_db('alarm_record')
        try {
            //let imei = js.client.data.deviceinfo.imei;
            db.view(this.__design_view, 'byIMEIGPSYEARMONTHDATE', {
                key: [
                    [Number.parseInt(y), Number.parseInt(m), Number.parseInt(d)], imei + ''
                ],
                descending: true,
                include_docs: true
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            //js.client.data.message = err;
            deferred.reject(error);
        }
        return deferred.promise;
    }
    get_last_working_status(imei, startitme, endtime, status) {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.view(this.__design_view, 'byIMEIACCGPSTIME', {
            descending: true,
            limit: 1,
            startkey: [imei, status, endtime],
            endkey: [imei, status, startitme],
            include_docs: true,
        },
            (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                } else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    //console.log(res);
                    deferred.resolve(arr);
                }
            });
        return deferred.promise;
    }
    get_previous_day_working_status(imei, startitme, endtime) {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        db.view(this.__design_view, 'byIMEIGPSTIME', {
            descending: true,
            limit: 1,
            startkey: [imei, endtime],
            endkey: [imei, startitme],
            include_docs: true,
        },
            (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                } else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    //console.log(res);
                    deferred.resolve(arr);
                }
            });
        return deferred.promise;
    }
    get_previous_day_parking_status(imei, startitme, endtime) {
        let deferred = Q.defer();
        let db = this.create_db('parking_record');
        db.view(this.__design_view, 'byIMEIGPSTIME', {
            descending: true,
            limit: 1,
            startkey: [imei, endtime],
            endkey: [imei, startitme],
            include_docs: true,
        },
            (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                } else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    //console.log(res);
                    deferred.resolve(arr);
                }
            });
        return deferred.promise;
    }
    get_parking_record(imei, y, m, d) {
        let deferred = Q.defer();
        let db = this.create_db('parking_record')
        try {
            //let imei = js.client.data.deviceinfo.imei;
            db.view(this.__design_view, 'byIMEIGPSYEARMONTHDATE', {
                key: [
                    [Number.parseInt(y), Number.parseInt(m), Number.parseInt(d)], imei + ''
                ],
                descending: true,
                include_docs: true
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            //js.client.data.message = err;
            deferred.reject(error);
        }
        return deferred.promise;
    }

    get_working_record(imei, y, m, d): Q.Promise<any> {
        let deferred = Q.defer();
        let db = this.create_db('working_record');
        try {
            //let imei = js.client.data.deviceinfo.imei;
            db.view(this.__design_view, 'byIMEIGPSYEARMONTHDATE', {
                key: [
                    [Number.parseInt(y), Number.parseInt(m), Number.parseInt(d)], imei + ''
                ],
                descending: true,
                include_docs: true
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            //js.client.data.message = err;
            deferred.reject(error);
        }
        return deferred.promise;
    }

    make_payment_ws(js) {
        let deferred = Q.defer();
        try {
            let bills = js.client.data.payment.bills;
            let arr = [];
            let discount = [];
            let p = js.client.data.payment;
            p.gui = uuidV4();
            p.sn = moment().valueOf();
            p.paidtime = (moment().format());
            p.imei = '';
            let sum_dis = 0;
            try {
                console.log('check discount bill');
                for (let index = 0; index < bills.length; index++) {
                    const element = bills[index];
                    if (element.sn.indexOf('_') === 0) {
                        element.gui = uuidV4();
                        element._id = element.gui;
                        element.isdone = true;
                        element.paidby = js.client.username;
                        element.paidtime = (moment().format());
                        element.paymentgui = p.gui;
                        element.totalvalue = element.working * element.effeciency * element.rate;
                        sum_dis += element.totalvalue;
                        discount.push(element);
                    }
                    else {
                        arr.push([element.imei, element.sn]);
                    }
                }
                console.log('check bills');
                this.findManyBillByImeiAndSn(arr).then(res => {
                    if (Array.isArray(res)) {
                        if (res.length) {
                            let imei = res[0].imei;
                            let sum = 0;
                            for (let index = 0; index < res.length; index++) {
                                const element = res[index];
                                element.isdone = true;
                                element.paidby = js.client.username;
                                element.paidtime = (moment().format());
                                element.paymentgui = p.gui;
                                element.totalvalue = element.productiontime.working * element.effeciency * element.rate;
                                sum += element.totalvalue;
                                // console.log('sum:' + sum);
                            }
                            // js.client.data.payment.bills=res;
                            console.log('update bill ' + res.length);
                            this.updateBulkBillIceMaker(res).then(res => {
                                console.log('update discount bill ' + discount.length);
                                this.updateBulkBillIceMaker(discount).then(res => {
                                    p.invoicetime = (moment().format());
                                    p.preparedby = js.client.username;
                                    p.imei = imei;
                                    p.totalvalue = sum;
                                    p.totaldiscount = sum_dis;
                                    p.totalpaid = p.totalvalue - p.totaldiscount;
                                    p.paidby = js.client.username;
                                    p.approvedtime = '';
                                    p.isapproved = false;
                                    p.approveby = '';
                                    js.client.data.payment = '';
                                    console.log('add payment ')
                                    this.addPayment(p).then(res => {
                                        js.client.data.message = 'OK made a payment ';
                                        js.client.data.payment = p;
                                        deferred.resolve(js);
                                    }).catch(err => {
                                        { console.log(err); deferred.reject(err); }
                                    });
                                });
                            }).catch(err => {
                                console.log(err);
                                throw err;
                            });
                        } else {
                            throw new Error('ERROR no bill were found');
                        }
                    }
                }).catch(err => {
                    { console.log(err); deferred.reject(err); }
                });
            } catch (error) {
                console.log(error);
                deferred.reject(error);
            }

        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }
    getPaymentBy_Id(id) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        db.list({ key: id, include_docs: true }, (err, res) => {
            if (err) {
                console.log(err);
            } else {
                deferred.resolve(res.rows[0].doc);
            }
        });
        return deferred.promise;
    }
    getPaymentList(js) {
        let deferred = Q.defer();
        this.findDeviceByUsername(js.client.username).then(res => {
            let devices = res as any[];
            let imeis = [];
            if (devices.length) {
                for (let index = 0; index < devices.length; index++) {
                    const element = devices[index].imei;
                    imeis.push(element);
                }
                this.getPaymentByImei(imeis).then(res => {
                    js.client.data.payment = res;
                    deferred.resolve(js);
                }).catch(err => {
                    console.log(err);
                    js.client.data.message = err;
                    deferred.reject(js);
                })
            } else {
                js.client.data.message = new Error('ERROR DEVICE NOT FOUND');
                deferred.reject(js);
            }
        }).catch(err => {
            console.log(err);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    getPaymentByImei(imei) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        //let gui = p.gui;
        try {
            db.view(this.__design_view, 'findByIMEI', {
                keys: imei,
                include_docs: true
            }, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    get_all_payment_ws(js) {
        let deferred = Q.defer();
        try {
            this.getApprovedPayment().then(res => {
                let ap = res;
                this.getNonApprovePayment().then(res => {
                    let nap = res;
                    js.client.data.ap = ap;
                    js.client.data.nap = nap;
                    js.client.data.message = 'OK get non approve and approved payment';
                    deferred.resolve(js);
                })
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }

    getNonApprovePayment() {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        try {
            db.view(this.__design_view, 'findNonApprovedPayment', (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    getApprovedPayment() {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        try {
            db.view(this.__design_view, 'findApprovedPayment', (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    getPaymentByPaidBy(username, paidtime) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        try {
            db.view(this.__design_view, 'findByUsername', {
                startkey: [username, paidtime],
                endkey: [username, '\ufff0'],
                include_docs: true
            }, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err)
                }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    approve_payment_ws(js) {
        let deferred = Q.defer();
        try {
            let gui = js.client.data.payment.gui;
            this.findPaymentByGui(gui).then(res => {
                if (!Array.isArray(res)) {
                    res = [res];
                }
                if (Array.isArray(res)) {
                    if (res) {
                        res[0].isapproved = true;
                        res[0].approveby = js.cient.username;
                        res[0].approvedtime = (moment().format());
                        this.updatePayment(res[0]).then(res => {
                            js.client.data.message = 'OK approve payment';
                            deferred.resolve(js);
                        });
                    } else {
                        throw new Error('ERROR payment not found');
                    }
                }
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }

    findPaymentByGui(gui) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        try {
            db.view(this.__design_view, 'findByGui', {
                key: gui + '',
                include_docs: true
            }, (err, res) => {
                if (err) deferred.reject(err);
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr[0]);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }

        return deferred.promise;
    }
    addPayment(p) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        //let gui = p.gui;
        try {
            db.insert(p, p.gui, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err)
                }
                else deferred.resolve('OK update payment');
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }
    updatePayment(p) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_payment');
        let gui = p.gui;
        try {
            db.insert(p, p._id, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err)
                }
                else deferred.resolve('OK update payment');
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    updateBulkBillIceMaker(array) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_bill');
        //billinfo.
        try {
            for (let index = 0; index < array.length; index++) {
                const billinfo = array[index];
                if (!billinfo._rev || billinfo._rev === undefined) {
                    billinfo._id = uuidV4();
                    billinfo.gui = billinfo._id;
                }

            }
            db.bulk({
                docs: array
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    deferred.resolve('OK update bulk bill ice maker');
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    addBillIceMaker(billinfo) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_bill');
        //billinfo.
        try {
            //billinfo.paidtime = (moment().format());
            db.insert(billinfo, billinfo.gui, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                }
                else {
                    deferred.resolve('OK add new bill');
                }
            });
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }


    async updateBillIceMaker(billinfo) {
        let deferred = Q.defer();
        let c_db = 'icemaker_bill';
        let db = this.create_db(c_db);
        //billinfo.
        try {
            // billinfo.paidtime = (moment().format());
            //console.log(`rev:${billinfo._rev} id:${billinfo._id}`);
            this.getBy_ID(billinfo._id, c_db).then(res => {
                if (res) {
                    billinfo._rev = res['_rev'];
                    // console.log(`rev:${billinfo._rev} id:${billinfo._id}`);
                    db.insert(billinfo, billinfo._id, (err, res) => {
                        if (err) {
                            console.log(err);
                            deferred.reject(err);
                        }
                        else {
                            deferred.resolve('OK update billinfo');
                        }
                    });
                }

            }).catch(err => {
                deferred.reject(err);
            });


        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }

    findManyBillByImeiAndSn(keys) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_bill');
        try {
            db.view(this.__design_view, 'findByImeiAndSn', {
                keys: keys,
                include_docs: true
            }, (err, res) => {
                if (err) {
                    console.log(err);
                    deferred.reject(err);
                }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }

        return deferred.promise;
    }

    findBillByImeiAndSn(imei, sn): Q.Promise<any> {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_bill');
        try {
            db.view(this.__design_view, 'findByImeiAndSn', {
                key: [imei, sn],
                include_docs: true
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(element);
                    }
                    deferred.resolve(arr);
                }
            });
        } catch (error) {
            deferred.reject(error);
        }

        return deferred.promise;
    }
    generateWorkingParkingPeriod(wp): any {
        return wp;
        // let w = wp.w;
        // let p = wp.p;
        // let _w = [];
        // let _p = [];
        // let _wp = { _w, _p };
        // let d = ("0" + time.d).slice(-2) + '';
        // let m = ("0" + (time.m - 1)).slice(-2) + '';
        // let start = new Date(Number.parseInt(time.y+''), Number.parseInt(m)-1, Number.parseInt(d), 0, 0, 0, 0);
        // let end = new Date(Number.parseInt(time.y+''), Number.parseInt(m)-1, Number.parseInt(d), 23, 59, 59, 999);

        // if (!w.length) {
        //     if (!p.length) {
        //         _p.push(start);    
        //         _w.push(end);            
        //     }else{
        //         _w.push(end);
        //     }
        // }else if(!p.length){
        //     if (!w.length) {
        //         _p.push(start);
        //         _w.push(end);
        //     }else{
        //         _p.push(end);
        //     }
        // }else{
        //     // add start
        //     let diff=new Date(w[0]).getTime()-new Date(p[0]).getTime();
        //     if(diff>0){
        //         _p=[start].concat(_p);
        //     }else{
        //         _w=[start].concat(_w);
        //     }
        //     // add end
        //     diff=new Date(w[w.length-1]).getTime()-new Date(p[p.length-1]).getTime();
        //     if(diff>0){
        //         _p.push(end);
        //     }else{
        //         _w.push(end);
        //     }
        // }



        // let y = w[0].getFullYear() + '';

        // if (w.length > p.length) {

        // }
        // // else if (w.length)
        //     for (let index = 0; index < array.length; index++) {
        //         const element = array[index];

        //     }

        //return _wp;
    }
    findLatestDataByImei(imei) {
        let deferred = Q.defer();
        try {

            let db = this.create_db('working_record');
            db.view(this.__design_view, 'byIMEIGPSTIME', {
                startkey: [imei + '', '\ufff0'],
                endkey: [imei],
                limit: 1,
                descending: true,
                include_docs: true
            }, (err, res) => {
                if (err) { console.log(err); deferred.reject(err); }
                else {
                    let arr = [];
                    for (let index = 0; index < res.rows.length; index++) {
                        const element = res.rows[index].doc;
                        arr.push(arr);
                    }
                    deferred.resolve(arr);
                }
            })
        } catch (error) {
            deferred.reject(error);
        }
        return deferred.promise;
    }
    get_latest_working_status_ws(js) {
        let deferred = Q.defer();
        try {
            let imei = js.client.data.device.imei;
            let y = js.client.data.year = js.client.data.year + '';
            let m = js.client.data.month = js.client.data.month + '';
            let d = js.client.data.day = js.client.data.day + '';
            let db = this.create_db('latest_record');
            db.list({ key: imei, include_docs: true }, (err, res) => {
                if (err) {
                    console.log(err);
                    js.client.data.message = err;
                    deferred.reject();
                } else {
                    if (res.rows.length) {
                        js.client.data.lastreport = res.rows[0].doc;
                    } else {
                        js.client.data.lastreport = {};
                    }
                    js.client.data.message = 'OK last report';
                    deferred.resolve(js);
                }
            });

        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }
    get_production_bills_ws(js) {
        let deferred = Q.defer();
        try {
            console.log('get ice maker bills');
            let imei = js.client.data.device.imei;
            let y = js.client.data.year = js.client.data.year + '';
            let m = js.client.data.month = js.client.data.month + '';
            let d = js.client.data.day = js.client.data.day + '';
            let sn = js.client.data.year;
            sn = (m.length == 1 ? '0' + m : m) + sn;
            sn = (d.length == 1 ? '0' + d : d) + sn;
            console.log('IMEI ,SN', imei, sn);
            this.findBillByImeiAndSn(imei, sn).then(res => {
                console.log(1875);
                if (res[0]) {
                    js.client.data.icemakerbill = res[0];
                    js.client.data.message = 'OK GET BILL';
                    console.log(1877);
                    deferred.resolve(js);
                } else {
                    console.log(1981);
                    deferred.reject(new Error('ERROR IMEI not found'));
                }
            }).catch(err => {
                console.log(err);
                deferred.reject(err);
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }
    get_production_time_manual(imei, y, m, d) {
        let deferred = Q.defer();
        try {
            let h = [];
            // let td = moment(moment.now());
            // //let needtime = (new Date(`${y}-${m}-${d}`));
            // let needtime = moment([y, m, d]);
            // //let seven_days_ago = (new moment.now().setDate(new Date(td). - 7));
            // let seven_days_ago = needtime.diff(td, 'days');
            let sn = y;
            sn = (m.length == 1 ? '0' + m : m) + sn;
            sn = (d.length == 1 ? '0' + d : d) + sn;
            let c_bill = [];
            this.findBillByImeiAndSn(imei, sn).then(res => {
                let c_bill = res;
                let b: any = {};
                if (c_bill.length) {
                    b = c_bill[0];
                } else {
                    b.isdone = false;
                }
                if (!b.isdone) {
                    this.findDeviceByImei(imei).then(res => {
                        console.log(1875);
                        if (res) {
                            console.log(1877);
                            this.get_working_record(imei, y, m, d).then(res => {
                                console.log(11879);
                                //if (res.length) {
                                console.log(1881);
                                let w = res;
                                this.get_parking_record(imei, y, m, d).then(async res => {
                                    let d1 = ("0" + Number.parseInt(d)).slice(-2) + '';
                                    let m1 = ("0" +Number.parseInt(m)).slice(-2) + '';
                                    let f_date = util.format("%s-%s-%s %s:%s:%s", y, m1, d1, '00', '00', '00');
                                    let endtime = moment(f_date, 'YYYY-MM-DD HH:mm:ss');
                                    //console.log('ENDTIME ',endtime);
                                    //let starttime = moment(endtime.valueOf() - 24 * 60 * 60 * 1000);
                                    let starttime=moment(endtime).subtract(1,'days');
                                    console.log('Fdate ',f_date);
                                    console.log('ENDTIME', endtime.format().replace('+07:00',''));
                                    console.log('START TIME', starttime.format().replace('+07:00',''));
                                    console.log(3049);
                                    let prev_parking: any = await this.get_previous_day_parking_status(imei, starttime.format().replace('+07:00',''), endtime.format().replace('+07:00',''));
                                    let prev_working: any = await this.get_previous_day_working_status(imei, starttime.format().replace('+07:00',''), endtime.format().replace('+07:00',''));

                                    //console.log(`${prev_parking} - ${prev_working}`);

                                    d1 = ("0" + d).slice(-2) + '';
                                    m1 = ("0" + (m)).slice(-2) + '';
                                    f_date = util.format("%s-%s-%s %s:%s:%s", y, m1, d1, '00', '00', '00');
                                    let btime = moment(f_date, 'YYYY-MM-DD HH:mm:ss').format().replace('+07:00','');
                                    let beginrecord = {
                                        imei: imei, acc: '0', mainpower: '0', gpstime: btime,
                                        servertime: btime
                                    };
                                    f_date = util.format("%s-%s-%s %s:%s:%s", y, m, d, '23', '59', '59');
                                    let ftime = moment(f_date, 'YYYY-MM-DD HH:mm:ss').format().replace('+07:00','');
                                    let finishrecord = {
                                        imei: imei, acc: '0', mainpower: '0', gpstime: ftime,
                                        servertime: ftime
                                    };

                                    //console.log(``);
                                    if (!prev_parking.length) {
                                        if (!prev_working.length) {
                                            beginrecord.acc = '0';
                                        } else {
                                            beginrecord.acc = '1';
                                        }
                                    } else if (!prev_working.length) {
                                        if (!prev_parking.length) {
                                            beginrecord.acc = '0';
                                        } else {
                                            beginrecord.acc = '0';
                                        }
                                    } else {
                                        let diff = (moment(prev_parking[0].gpstime).valueOf() - moment(prev_working[0].gpstime).valueOf());
                                        // console.log(`DIFF: ${diff}`);
                                        if (diff > 0) {
                                            beginrecord.acc = '0';
                                        } else if (diff < 0) {
                                            beginrecord.acc = '1';
                                        } else {
                                            beginrecord.acc = '0';
                                        }
                                    }
                                    //console.log(`${JSON.stringify(beginrecord)} ${JSON.stringify(finishrecord)}`);

                                    console.log(1884);
                                    let p = res;
                                    h = w.concat(p);
                                    if (h.length === 0) {
                                        beginrecord.acc = '0';
                                    }
                                    h.push(beginrecord);
                                    h.sort((a, b) => {
                                        return ((moment(a.gpstime)).valueOf() - (moment(b.gpstime)).valueOf())
                                    });
                                    if (moment(finishrecord.gpstime).valueOf() - moment(h[h.length - 1].gpstime).valueOf() < 1000 * 60 * 15) {
                                        finishrecord.acc = h[h.length - 1].acc;
                                        h.push(finishrecord);
                                    }
                                    //
                                    //finishrecord.acc = h[h.length - 1].acc;
                                    //h.push(finishrecord);
                                    // 

                                    let c_working = 0;
                                    let c_parking = 0;
                                    let c_problem = 0;
                                    let previousTime: Date;
                                    let status = 0;
                                    let workingPoints = [];
                                    let parkingPoints = [];
                                    let problemPoints = [];
                                    let otherPoints = [];
                                    let prevParking = 0;
                                    let prevWorking = 0;
                                    let prevProblem = 0;
                                    let prevOther = 0;
                                    let sumWorking = 0;
                                    let sumParking = 0;
                                    let sumProblem = 0;
                                    let sumOther = 0;
                                    let sumdif = 0;
                                    // console.log(1895);
                                    //console.log(h.length);
                                    for (let index = 0; index < h.length; index++) {
                                        let e = h[index];
                                        if (!this.isDate(e.gpstime.toString())) {
                                            console.log(e.gpstime);
                                            console.log('wrong gpstime');
                                            if (!this.isDate(e.servertime.toString())) {
                                                console.log(e.servertime);
                                                console.log('wrong servertime');
                                                continue;
                                            } else {
                                                e.gpstime = e.servertime;
                                            }
                                        }

                                        // if(e.acc===undefined) continue;

                                        let currentTime = moment(e.gpstime);
                                        if (e.acc + '' === '1' && e.mainpower === undefined || !e.mainpower) {
                                            e.mainpower = '0';
                                        } else if (e.mainpower === undefined || !e.mainpower) {
                                            e.mainpower = '1';
                                        }
                                        if (previousTime !== undefined) {
                                            let c_time = moment(e.gpstime);
                                            let diff = (c_time.valueOf() - previousTime.valueOf()) / 1000;
                                            // console.log(2637);
                                            if (status === 1) {
                                                c_working += diff;
                                                sumWorking += diff;
                                                sumParking = 0;
                                                sumProblem = 0;
                                                sumOther = 0;
                                            } else if (status === 0) {
                                                c_parking += diff;
                                                sumWorking = 0;
                                                sumParking += diff;
                                                sumProblem = 0;
                                                sumOther = 0;
                                            } else {
                                                c_problem += diff;
                                                sumWorking = 0;
                                                sumParking = 0;
                                                sumProblem += diff
                                                sumOther = 0;
                                            }
                                            if (diff > 180) {
                                                c_problem += diff;
                                                sumWorking = 0;
                                                sumParking = 0;
                                                sumProblem += diff
                                                sumOther = 0;
                                                if (problemPoints.length) {
                                                    problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                } else
                                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                            }
                                            //   console.log(2668);
                                        }
                                        // console.log(2669);

                                        if (e.mainpower + '' === '0') {
                                            if (e.acc + '' === '1') {
                                                status = 1;
                                                //console.log(2679);
                                                if (!prevWorking) {
                                                    if (problemPoints.length && prevProblem)
                                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    if (parkingPoints.length && prevParking)
                                                        parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                                    if (otherPoints.length && prevOther)
                                                        otherPoints[otherPoints.length - 1].totaltime = sumOther;
                                                    workingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                }
                                                prevWorking = 1;
                                                prevParking = 0;
                                                prevProblem = 0;
                                                prevOther = 0;
                                                // console.log(2693);
                                            } else {
                                                status = 0;
                                                //  console.log(2696);
                                                if (!prevParking) {
                                                    if (problemPoints.length && prevProblem)
                                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    if (workingPoints.length && prevWorking)
                                                        workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                                    if (otherPoints.length && prevOther)
                                                        otherPoints[otherPoints.length - 1].totaltime = sumOther

                                                    parkingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                }
                                                prevWorking = 0;
                                                prevParking = 1;
                                                prevProblem = 0;
                                                prevOther = 0;
                                                //    console.log(2711);
                                            }
                                        } else if (e.mainpower + '' === '1') {
                                            status = -1;
                                            //  console.log(2703);
                                            if (!prevProblem) {
                                                if (parkingPoints.length && prevParking)
                                                    parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                                if (workingPoints.length && prevWorking)
                                                    workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                                if (otherPoints.length && prevOther)
                                                    otherPoints[otherPoints.length - 1].totaltime = sumOther

                                                problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                            }
                                            //  console.log(2710);
                                            prevWorking = 0;
                                            prevParking = 0;
                                            prevProblem = 1;
                                            prevOther = 0;
                                        }
                                        e.status = status;
                                        previousTime = moment(e.gpstime).toDate();
                                        //console.log('assign previous time');
                                    }
                                    //console.log('w:%s p:%s pr:%s', c_working, c_parking, c_problem);
                                    c_working /= 3600;
                                    c_parking /= 3600;
                                    c_problem /= 3600;
                                    let wp = this.generateWorkingParkingPeriod({ workingpoints: workingPoints, parkingpoints: parkingPoints, otherpoints: otherPoints, problempoints: problemPoints });
                                    let bill = {
                                        day: d,
                                        month: m,
                                        year: y,
                                        lasteststatus: [wp],
                                        productiondetails: [],
                                        productiontime: {
                                            working: c_working,
                                            parking: c_parking,
                                            problem: c_problem
                                        },
                                        temps: [
                                            { hour: 0, temp: 0, wind: 0, outsidetemp: 0, humidity: 0, tempin: 0, tempmax: 0, weathertype: '', weatherdescription: '' }],
                                        powerconsumption: [{ hour: 0, amp: 0, voltage: 0, watt: 0, pf: 0 },
                                        ],
                                        effeciency: 8, // get current effeciency by imei
                                        rate: 250,// get current rate by imei
                                        totalvalue: 0,
                                        imei: imei,
                                        sn: sn,
                                        isdone: false,
                                        paidtime: '',
                                        description: '',
                                        paymentgui: '',
                                        paidby: '',
                                        generatedtime: (moment().format()),
                                        gui: uuidV4(),
                                        lastupdate: [(moment().format())]
                                    }
                                    bill.totalvalue = bill.rate * bill.effeciency * bill.productiontime.working;
                                    if (c_bill.length) {
                                        bill['_rev'] = c_bill[0]._rev;
                                        bill['gui'] = c_bill[0].gui;
                                        bill['_id'] = c_bill[0]._id;
                                        //console.log(1961);
                                        //if (!bill.lastupdate) {
                                        console.log('LAST UPDATE');

                                        console.log((moment().format()));
                                        console.log(moment().format());
                                        bill.lastupdate = [(moment().format())];
                                        //}
                                        console.log('updating');
                                        console.log('BILL DATE ' + d + ' DATA LENGTH' + c_bill.length);
                                        this.updateBillIceMaker(bill).then(res => {
                                            let db = this.create_db('latest_record');
                                            db.list({ key: bill.imei, include_docs: true }, (err, res) => {
                                                if (err) {
                                                    console.log(err);
                                                    throw err;
                                                } else {
                                                    console.log('UPDATED LATEST');
                                                    if (res.rows.length) {
                                                        let doc = res.rows[0].doc;
                                                        bill.sn = 'R' + bill.sn;
                                                        doc.data.icemakerbill = bill;
                                                        db.insert(doc, doc._id, (err, res) => {
                                                            if (err) {
                                                                console.log(err);
                                                            } else {
                                                                console.log(res);
                                                            }
                                                        });
                                                    }

                                                }
                                            });
                                            deferred.resolve(bill);
                                        }).catch(err => {
                                            console.log(err);
                                            deferred.reject(err);
                                        });
                                    } else {
                                        console.log('BILL DATE ' + d + ' DATA LENGTH' + c_bill.length);
                                        console.log('inserting');
                                        this.addBillIceMaker(bill).then(res => {
                                            // js.client.data.icemakerbill.lasteststatus =[wp];
                                            // js.client.data.icemakerbill.productiondetails = h;
                                            let db = this.create_db('latest_record');
                                            db.list({ key: bill.imei, include_docs: true }, (err, res) => {
                                                if (err) {
                                                    console.log(err);
                                                    throw err;
                                                } else {
                                                    console.log('INSERTED LATEST');
                                                    if (res.rows.length) {
                                                        let doc = res.rows[0].doc;
                                                        bill.sn = 'R' + bill.sn;
                                                        doc.data.icemakerbill = bill;
                                                        db.insert(doc, doc._id, (err, res) => {
                                                            if (err) {
                                                                console.log(err);
                                                            } else {
                                                                console.log(res);
                                                            }
                                                        });
                                                    }

                                                }
                                            });
                                            deferred.resolve(bill);
                                        }).catch(err => {
                                            console.log(err);
                                            deferred.reject(err);
                                        });
                                    }

                                });
                                // } else {
                                //     console.log(1976);
                                //     throw new Error('ERROR no record found');
                                // }
                            });
                        } else {
                            console.log(1981);
                            throw new Error('ERROR IMEI not found');
                        }
                    }).catch(err => {
                        console.log(err);
                        deferred.reject(err);
                    });
                } else {
                    console.log('BILL DATE ' + d + ' DATA LENGTH' + c_bill.length);
                    deferred.resolve(c_bill[0])
                }

            });

        } catch (error) {
            console.log(error);
            // js.client.data.message = error;
            deferred.reject(error);
        }

        return deferred.promise;
    }
    get_production_time_details_ws(js) {
        let deferred = Q.defer();
        try {
            let imei = js.client.data.device.imei;
            let h = [];
            let y = js.client.data.year = js.client.data.year + '';
            let m = js.client.data.month = js.client.data.month + '';
            let d = js.client.data.day = js.client.data.day + '';
            let td = moment(moment.now());
            //let needtime = (new Date(`${y}-${m}-${d}`));
            let needtime = moment([y, m, d]);
            //let seven_days_ago = (new moment.now().setDate(new Date(td). - 7));
            // let seven_days_ago = needtime.diff(td, 'days');
            let sn = js.client.data.year;
            sn = (m.length == 1 ? '0' + m : m) + sn;
            sn = (d.length == 1 ? '0' + d : d) + sn;
            let c_bill = [];
            console.log(1877);
            this.get_working_record(imei, y, m, d).then(res => {
                console.log(11879);
                //if (res.length) {
                console.log(1881);
                let w = res;
                this.get_parking_record(imei, y, m, d).then(async res => {


                    console.log(1884);
                    let p = res;
                    h = w.concat(p);

                    h.sort((a, b) => {
                        return ((moment(a.gpstime)).valueOf() - (moment(b.gpstime)).valueOf())
                    });

                    // 

                    let c_working = 0;
                    let c_parking = 0;
                    let c_problem = 0;
                    let previousTime: Date;
                    let status = 0;
                    let workingPoints = [];
                    let parkingPoints = [];
                    let problemPoints = [];
                    let otherPoints = [];
                    let prevParking = 0;
                    let prevWorking = 0;
                    let prevProblem = 0;
                    let prevOther = 0;
                    let sumWorking = 0;
                    let sumParking = 0;
                    let sumProblem = 0;
                    let sumOther = 0;
                    let sumdif = 0;
                    // console.log(1895);
                    //console.log(h.length);
                    for (let index = 0; index < h.length; index++) {
                        let e = h[index];
                        if (!this.isDate(e.gpstime.toString())) {
                            console.log(e.gpstime);
                            console.log('wrong gsptime');
                            continue;
                            // if (!this.isDate(e.servertime)) {
                            //     console.log(e.servertime);
                            //     console.log('wrong servertime');
                            //     continue;
                            // } else {
                            //     e.gpstime = e.servertime;
                            // }
                        }

                        // if(e.acc===undefined) continue;

                        let currentTime = moment(e.gpstime).toDate();
                        if (e.acc + '' === '1' && e.mainpower === undefined || !e.mainpower) {
                            e.mainpower = '0';
                        } else if (e.mainpower === undefined || !e.mainpower) {
                            e.mainpower = '1';
                        }
                        if (previousTime !== undefined) {
                            // let c_time = moment(e.gpstime).toDate();
                            //let diff = (c_time.getTime() - previousTime.getTime()) / 1000;
                            let diff = moment(e.gpstime).diff(previousTime, 'milliseconds') / 1000;
                            // console.log(2637);
                            if (status === 1) {
                                c_working += diff;
                                sumWorking += diff;
                                sumParking = 0;
                                sumProblem = 0;
                                sumOther = 0;
                            } else if (status === 0) {
                                c_parking += diff;
                                sumWorking = 0;
                                sumParking += diff;
                                sumProblem = 0;
                                sumOther = 0;
                            } else {
                                c_problem += diff;
                                sumWorking = 0;
                                sumParking = 0;
                                sumProblem += diff
                                sumOther = 0;
                            }
                            if (diff > 300) {
                                c_problem += diff;
                                sumWorking = 0;
                                sumParking = 0;
                                sumProblem += diff
                                sumOther = 0;
                                if (problemPoints.length) {
                                    problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                } else
                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                            }
                            //   console.log(2668);
                        }
                        // console.log(2669);

                        if (e.mainpower + '' === '0') {
                            if (e.acc + '' === '1') {
                                status = 1;
                                //console.log(2679);
                                if (!prevWorking) {
                                    if (problemPoints.length && prevProblem)
                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                    if (parkingPoints.length && prevParking)
                                        parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                    if (otherPoints.length && prevOther)
                                        otherPoints[otherPoints.length - 1].totaltime = sumOther;
                                    workingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                }
                                prevWorking = 1;
                                prevParking = 0;
                                prevProblem = 0;
                                prevOther = 0;
                                // console.log(2693);
                            } else {
                                status = 0;
                                //  console.log(2696);
                                if (!prevParking) {
                                    if (problemPoints.length && prevProblem)
                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                    if (workingPoints.length && prevWorking)
                                        workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                    if (otherPoints.length && prevOther)
                                        otherPoints[otherPoints.length - 1].totaltime = sumOther

                                    parkingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                }
                                prevWorking = 0;
                                prevParking = 1;
                                prevProblem = 0;
                                prevOther = 0;
                                //    console.log(2711);
                            }
                        } else if (e.mainpower + '' === '1') {
                            status = -1;
                            //  console.log(2703);
                            if (!prevProblem) {
                                if (parkingPoints.length && prevParking)
                                    parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                if (workingPoints.length && prevWorking)
                                    workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                if (otherPoints.length && prevOther)
                                    otherPoints[otherPoints.length - 1].totaltime = sumOther

                                problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                            }
                            //  console.log(2710);
                            prevWorking = 0;
                            prevParking = 0;
                            prevProblem = 1;
                            prevOther = 0;
                        }
                        e.status = status;
                        previousTime = moment(e.gpstime).toDate();
                        //console.log('assign previous time');
                    }
                    // console.log('w:%s p:%s pr:%s', c_working, c_parking, c_problem);
                    c_working /= 3600;
                    c_parking /= 3600;
                    c_problem /= 3600;
                    let wp = this.generateWorkingParkingPeriod({ workingpoints: workingPoints, parkingpoints: parkingPoints, otherpoints: otherPoints, problempoints: problemPoints });
                    let bill = {
                        day: js.client.data.day,
                        month: js.client.data.month,
                        year: js.client.data.year,
                        lasteststatus: [wp],
                        productiondetails: [],
                        productiontime: {
                            working: c_working,
                            parking: c_parking,
                            problem: c_problem
                        },
                        temps: [
                            { hour: 0, temp: 0, wind: 0, outsidetemp: 0, humidity: 0, tempin: 0, tempmax: 0, weathertype: '', weatherdescription: '' }],
                        powerconsumption: [{ hour: 0, amp: 0, voltage: 0, watt: 0, pf: 0 },
                        ],
                        effeciency: 8, // get current effeciency by imei
                        rate: 250,// get current rate by imei
                        totalvalue: 0,
                        imei: imei,
                        sn: sn,
                        isdone: false,
                        paidtime: '',
                        description: '',
                        paymentgui: '',
                        paidby: '',
                        generatedtime: (moment().format()),
                        gui: uuidV4(),
                        _id: '',
                        lastupdate: [(moment().format())]
                    };
                    bill._id = bill.gui;
                    bill.totalvalue = bill.rate * bill.effeciency * bill.productiontime.working;
                    js.client.data.icemakerbill = bill;
                    js.client.data.icemakerbill.productiondetails = h;
                    deferred.resolve(js);
                });
            });
        } catch (error) {
            console.log(error);
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }
    verifyDataTime(data: any[], y: any, m: any, d: any) {
        let need: any[] = [];
        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            if (element) {
                if (element.gpstime) {
                    if (moment(element.gpstime).date() != d || moment(element.gpstime).month() + 1 != m || moment(element.gpstime).year() != y) {
                        need.push(element);
                        data.splice(index, 1);
                    }
                }
            }
        }
        return need;
    }
    get_production_time_ws(js) {
        let deferred = Q.defer();
        try {
            let imei = js.client.data.device.imei;
            let h = [];
            let y = js.client.data.year = js.client.data.year + '';
            let m = js.client.data.month = js.client.data.month + '';
            let d = js.client.data.day = js.client.data.day + '';
            let td = moment(moment.now());
            //let needtime = (new Date(`${y}-${m}-${d}`));
            let needtime = moment([y, m, d]);
            //let seven_days_ago = (new moment.now().setDate(new Date(td). - 7));            
            let sn = js.client.data.year;
            sn = (m.length == 1 ? '0' + m : m) + sn;
            sn = (d.length == 1 ? '0' + d : d) + sn;
            let c_bill = [];
            this.findBillByImeiAndSn(imei, sn).then(res => {
                c_bill = res;
                let b: any = {};
                if (c_bill.length) {
                    b = c_bill[0];
                } else {
                    b.isdone = false;
                }
                if (!b.isdone) {
                    this.findDeviceByImei(imei).then(res => {
                        console.log(1875);
                        if (res) {
                            console.log(1877);
                            this.get_working_record(imei, y, m, d).then(res => {
                                console.log(11879);
                                //if (res.length) {
                                console.log(1881);
                                let w = res;
                                this.get_parking_record(imei, y, m, d).then(async res => {
                                    let p = res as any[];
                                    //*********** FIX WRONG DATE DATA */
                                    // let need: any[] = this.verifyDataTime(w, y, m, d);
                                    // if (p.length)
                                    //     need = need.concat(this.verifyDataTime(p, y, m, d));
                                    // console.log('NEED TO BE UPDATED %s', need.length);
                                    // let n=await this.updateBulkDoc(need,'working_record'); 
                                    // console.log('FINISHED UPDATE NEED ',n);
                                    // END FIXING WRONG DATE DATA
                                    let d1 = ("0" + Number.parseInt(d)).slice(-2) + '';
                                    let m1 = ("0" + Number.parseInt(m)).slice(-2) + '';
                                    let f_date = util.format("%s-%s-%s %s:%s:%s", y, m1, d1, '00', '00', '00');
                                    let endtime = moment(f_date, 'YYYY-MM-DD HH:mm:ss');
                                    //console.log('ENDTIME ',endtime);
                                    //let starttime = moment(endtime.valueOf() - 24 * 60 * 60 * 1000);
                                    let starttime=moment (endtime).subtract(1,'days');
                                    console.log('Fdate ',f_date);
                                    console.log('ENDTIME', endtime.format().replace('+07:00',''));
                                    console.log('START TIME', starttime.format().replace('+07:00',''));
                                    console.log(3049);
                                    let prev_parking: any = await this.get_previous_day_parking_status(imei, starttime.format().replace('+07:00', ''), endtime.format().replace('+07:00', ''));
                                    let prev_working: any = await this.get_previous_day_working_status(imei, starttime.format().replace('+07:00', ''), endtime.format().replace('+07:00', ''));

                                    console.log(`parking: ${prev_parking} - working:${prev_working}`);

                                    d1 = ("0" + d).slice(-2) + '';
                                    m1 = ("0" + (m)).slice(-2) + '';
                                    f_date = util.format("%s-%s-%s %s:%s:%s", y, m1, d1, '00', '00', '00');
                                    let btime = moment(f_date, 'YYYY-MM-DD HH:mm:ss').format().replace('+07:00','');
                                    let beginrecord = {
                                        imei: imei, acc: '0', mainpower: '0', gpstime: btime,
                                        servertime: btime
                                    };
                                    f_date = util.format("%s-%s-%s %s:%s:%s", y, m, d, '23', '59', '59');
                                    let ftime = moment(f_date, 'YYYY-MM-DD HH:mm:ss').format().replace('+07:00','');
                                    let finishrecord = {
                                        imei: imei, acc: '0', mainpower: '0', gpstime: ftime,
                                        servertime: ftime
                                    };
                                    // let finishrecord = {
                                    //     imei: imei, acc: '0', mainpower: '0', gpstime: new Date(Number.parseInt(y), Number.parseInt(m) , Number.parseInt(d), 23, 59, 59, 999).toString(),
                                    //     servertime: moment().(Number.parseInt(y), Number.parseInt(m) , Number.parseInt(d), 23, 59, 59, 999).toString()
                                    // };

                                    console.log('working parking ',btime, ftime);
                                    if (!prev_parking.length) {
                                        if (!prev_working.length) {
                                            beginrecord.acc = '0';
                                        } else {
                                            beginrecord.acc = prev_working[0].acc; // in case there is no parking data from April up to now
                                        }
                                    } else if (!prev_working.length) {
                                        if (!prev_parking.length) {
                                            beginrecord.acc = '0';
                                        } else {
                                            beginrecord.acc = '0';
                                        }
                                    } else {
                                        let diff = (moment(prev_parking[0].gpstime).valueOf() - moment(prev_working[0].gpstime).valueOf());
                                        // console.log(`DIFF: ${diff}`);
                                        if (diff > 0) {
                                            beginrecord.acc = '0';
                                        } else if (diff < 0) {
                                            beginrecord.acc = '1';
                                        } else {
                                            beginrecord.acc = '0';
                                        }
                                    }
                                    console.log(`${JSON.stringify(beginrecord)} ${JSON.stringify(finishrecord)}`);


                                    console.log(1884);

                                    h = w.concat(p);
                                    if (h.length === 0) {
                                        beginrecord.acc = '0';
                                    }
                                    h.push(beginrecord);
                                    h.sort((a, b) => {
                                        return ((moment(a.gpstime)).valueOf() - (moment(b.gpstime)).valueOf());
                                        // return new Date(a.gpstime) - new Date(b.gpstime);
                                        // return moment(a.gpstime).diff(moment(b.gpstime),'milliseconds')
                                    });

                                    //
                                    if ((moment(finishrecord.gpstime).valueOf() - moment(h[h.length - 1].gpstime).valueOf()) < 1000 * 60 * 15) {
                                        finishrecord.acc = h[h.length - 1].acc;
                                        h.push(finishrecord);
                                    }
                                    //finishrecord.acc = h[h.length - 1].acc;
                                    //h.push(finishrecord);
                                    // 

                                    let c_working = 0;
                                    let c_parking = 0;
                                    let c_problem = 0;
                                    let previousTime: Date;
                                    let status = 0;
                                    let workingPoints = [];
                                    let parkingPoints = [];
                                    let problemPoints = [];
                                    let otherPoints = [];
                                    let prevParking = 0;
                                    let prevWorking = 0;
                                    let prevProblem = 0;
                                    let prevOther = 0;
                                    let sumWorking = 0;
                                    let sumParking = 0;
                                    let sumProblem = 0;
                                    let sumOther = 0;
                                    // let sumdif = 0;
                                    // console.log(1895);
                                    //console.log(h.length);
                                    for (let index = 0; index < h.length; index++) {
                                        let e = h[index];
                                        if (!this.isDate(e.gpstime.toString())) {
                                            console.log(e.gpstime);
                                            console.log("wrong gpstime")
                                            if (!this.isDate(e.servertime.toString())) {
                                                console.log(e.servertime);
                                                console.log('wrong servertime');
                                                continue;
                                            } else {
                                                e.gpstime = e.servertime;
                                            }
                                        }

                                        // if(e.acc===undefined) continue;

                                        // let currentTime = new Date(e.gpstime);
                                        if (e.acc + '' === '1' && e.mainpower === undefined || !e.mainpower) {
                                            e.mainpower = '0';
                                        } else if (e.mainpower === undefined || !e.mainpower) {
                                            e.mainpower = '1';
                                        }
                                        if (previousTime !== undefined) {
                                            //let c_time = new Date(e.gpstime);
                                            //let diff = (c_time.getTime() - previousTime.getTime()) / 1000;
                                            let c_time = moment(e.gpstime);
                                            let diff = (c_time.diff(previousTime, 'milliseconds')) / 1000;
                                            // console.log(2637);
                                            if (status === 1) {
                                                c_working += diff;
                                                sumWorking += diff;
                                                sumParking = 0;
                                                sumProblem = 0;
                                                sumOther = 0;
                                            } else if (status === 0) {
                                                c_parking += diff;
                                                sumWorking = 0;
                                                sumParking += diff;
                                                sumProblem = 0;
                                                sumOther = 0;
                                            } else {
                                                c_problem += diff;
                                                sumWorking = 0;
                                                sumParking = 0;
                                                sumProblem += diff
                                                sumOther = 0;
                                            }
                                            if (diff > 180) {
                                                c_problem += diff;
                                                sumWorking = 0;
                                                sumParking = 0;
                                                sumProblem += diff
                                                sumOther = 0;
                                                if (problemPoints.length) {
                                                    problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                } else
                                                    problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                            }
                                            //   console.log(2668);
                                        }
                                        // console.log(2669);

                                        if (e.mainpower + '' === '0') {
                                            if (e.acc + '' === '1') {
                                                status = 1;
                                                //console.log(2679);
                                                if (!prevWorking) {
                                                    if (problemPoints.length && prevProblem)
                                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    if (parkingPoints.length && prevParking)
                                                        parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                                    if (otherPoints.length && prevOther)
                                                        otherPoints[otherPoints.length - 1].totaltime = sumOther;
                                                    workingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                }
                                                prevWorking = 1;
                                                prevParking = 0;
                                                prevProblem = 0;
                                                prevOther = 0;
                                                // console.log(2693);
                                            } else {
                                                status = 0;
                                                //  console.log(2696);
                                                if (!prevParking) {
                                                    if (problemPoints.length && prevProblem)
                                                        problemPoints[problemPoints.length - 1].totaltime = sumProblem;
                                                    if (workingPoints.length && prevWorking)
                                                        workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                                    if (otherPoints.length && prevOther)
                                                        otherPoints[otherPoints.length - 1].totaltime = sumOther

                                                    parkingPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                                }
                                                prevWorking = 0;
                                                prevParking = 1;
                                                prevProblem = 0;
                                                prevOther = 0;
                                                //    console.log(2711);
                                            }
                                        } else if (e.mainpower + '' === '1') {
                                            status = -1;
                                            //  console.log(2703);
                                            if (!prevProblem) {
                                                if (parkingPoints.length && prevParking)
                                                    parkingPoints[parkingPoints.length - 1].totaltime = sumParking;
                                                if (workingPoints.length && prevWorking)
                                                    workingPoints[workingPoints.length - 1].totaltime = sumWorking;
                                                if (otherPoints.length && prevOther)
                                                    otherPoints[otherPoints.length - 1].totaltime = sumOther

                                                problemPoints.push({ gpstime: e.gpstime, totaltime: 0, gui: e.gui, acc: e.acc, mainpower: e.mainpower });
                                            }
                                            //  console.log(2710);
                                            prevWorking = 0;
                                            prevParking = 0;
                                            prevProblem = 1;
                                            prevOther = 0;
                                        }
                                        e.status = status;
                                        // previousTime = new Date(e.gpstime);
                                        previousTime = moment(e.gpstime).toDate();
                                        //console.log('assign previous time');
                                    }
                                    //console.log('w:%s p:%s pr:%s', c_working, c_parking, c_problem);
                                    c_working /= 3600;
                                    c_parking /= 3600;
                                    c_problem /= 3600;
                                    let wp = this.generateWorkingParkingPeriod({ workingpoints: workingPoints, parkingpoints: parkingPoints, otherpoints: otherPoints, problempoints: problemPoints });
                                    let bill = {
                                        day: js.client.data.day,
                                        month: js.client.data.month,
                                        year: js.client.data.year,
                                        lasteststatus: [wp],
                                        productiondetails: [],
                                        productiontime: {
                                            working: c_working,
                                            parking: c_parking,
                                            problem: c_problem
                                        },
                                        temps: [
                                            { hour: 0, temp: 0, wind: 0, outsidetemp: 0, humidity: 0, tempin: 0, tempmax: 0, weathertype: '', weatherdescription: '' }],
                                        powerconsumption: [{ hour: 0, amp: 0, voltage: 0, watt: 0, pf: 0 },
                                        ],
                                        effeciency: 8, // get current effeciency by imei
                                        rate: 250,// get current rate by imei
                                        totalvalue: 0,
                                        imei: imei,
                                        sn: sn,
                                        isdone: false,
                                        paidtime: '',
                                        description: '',
                                        paymentgui: '',
                                        paidby: '',
                                        generatedtime: (moment().format()),
                                        gui: uuidV4(),
                                        _id: '',
                                        lastupdate: [(moment().format())]
                                    };
                                    // console.log('bill: ');
                                    // console.log(bill);
                                    bill._id = bill.gui;
                                    bill.totalvalue = bill.rate * bill.effeciency * bill.productiontime.working;
                                    js.client.data.icemakerbill = bill;
                                    //js.client.data.icemakerbill.productiondetails = h;
                                    if (c_bill.length) {
                                        bill['_rev'] = c_bill[0]._rev;
                                        bill['gui'] = c_bill[0]._id;
                                        bill['_id'] = c_bill[0]._id;

                                        // console.log(1961);
                                        // bill.productiondetails.length = 0;
                                        // js.client.data.icemakerbill.lasteststatus.length = 0;
                                        //if (!bill.lastupdate) {
                                        bill.lastupdate = [(moment().format())];
                                        //}
                                        console.log('updating');
                                        console.log('BILL DATE ' + d + ' DATA LENGTH' + c_bill.length);
                                        this.updateBillIceMaker(bill).then(res => {
                                            js.client.data.message = 'OK exist bill update';
                                            //js.client.data.icemakerbill.lasteststatus =[wp];
                                            // js.client.data.icemakerbill.productiondetails = h;
                                            deferred.resolve(js);
                                        }).catch(err => {
                                            console.log(err);
                                            deferred.reject(err);
                                        });
                                    } else {
                                        console.log('inserting new ');
                                        // bill.productiondetails.length=0;
                                        // js.client.data.icemakerbill.lasteststatus.length=0;
                                        this.addBillIceMaker(bill).then(res => {
                                            js.client.data.message = 'OK new bill';
                                            // js.client.data.icemakerbill.lasteststatus =[wp];
                                            // js.client.data.icemakerbill.productiondetails = h;
                                            deferred.resolve(js);
                                        }).catch(err => {
                                            console.log(err);
                                            deferred.reject(err);
                                        });
                                    }

                                });
                                // } else {
                                //     console.log(1976);
                                //     throw new Error('ERROR no record found');
                                // }
                            });
                        } else {
                            console.log(1981);
                            throw new Error('ERROR IMEI not found');
                        }
                    }).catch(err => {
                        console.log(err);
                        deferred.reject(err);
                    });
                } else {
                    console.log('BILL DATE ' + d + ' DATA LENGTH' + c_bill.length);
                    js.client.data.message = 'OK bill has been done';
                    js.client.data.icemakerbill = c_bill[0];
                    deferred.resolve(js)
                }

            });

        } catch (error) {
            console.log(error);
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }

    update_icemaker_device_owner_ws(js) {
        let deferred = Q.defer();
        try {
            let imei = js.client.data.device.imei;
            this.findDeviceByImei(imei).then(res => {
                let gui = js.client.auth.gui;
                if (!Array.isArray(res)) {
                    res = [res];
                }
                if (Array.isArray(res)) {
                    if (res) {
                        let d = res[0];
                        d.updatedtime = (moment().format());
                        this.findUserByUsername(js.client.data.device.currentusername).then(res => {
                            let u = res[0];
                            if (u.indexOf(js.client.data.device.currentusername) < 0) {
                                js.client.data.device.ownername.push(js.client.data.device.currentusername);
                            }
                            js.client.data.usernames = js.client.data.device.ownername;
                            this.findUserByManyUsername(js).then(res => {
                                if (!Array.isArray(res)) {
                                    res = [res];
                                }
                                if (Array.isArray(res)) {
                                    let users = res;
                                    for (let index = 0; index < js.client.data.device.ownername.length; index++) {
                                        const element = js.client.data.device.ownername[index];
                                        let exist = false;
                                        for (let index = 0; index < users.length; index++) {
                                            const e = users[index];
                                            if (e.indexOf(element) > -1) {
                                                exist = true;
                                                break;
                                            }
                                        }
                                        if (exist === false)
                                            js.client.data.device.ownername.splice(js.client.data.device.ownername.indexOf(element), 1);
                                    }
                                    this.updateIcemakerDevice(js.client.data.device).then(res => {
                                        js.client.data.message = 'OK update devices';
                                        this.filterObject(js.client.data.user);
                                        deferred.resolve(js);
                                    }).catch(err => {
                                        console.log(err);
                                        deferred.reject(err);
                                    });
                                }
                            });

                        });
                    } else {
                        throw new Error('ERROR IMEI not found');
                    }
                }
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }

    saveAttachementsToFiles(array) {
        try {
            for (let index = 0; index < array.length; index++) {
                const element = array[index];
                //console.log(element.data)
                fs.writeFileSync(__dirname + '/public/profiles/' + element.name, element.data, 'utf8');
            }
        } catch (error) {
            throw error;
        }

    }
    cloneObj(from, to) {
        for (let o in to) {
            if (from[o] === undefined) {
                //to[o]=
            } else {
                to[o] = from[o];
            }
        }
        return to;
    }
    update_icemaker_device_ws(js) {
        let deferred = Q.defer();
        try {
            let imei = js.client.data.device.imei;
            console.log('checking exist imei');
            this.findDeviceByImei(imei).then(res => {
                if (Array.isArray(res)) {
                    let gui = js.client.auth.gui;
                    console.log('FIND BY IMEI');
                    console.log(res);
                    if (res.length > 0) { // FOR UPDATE                       
                        console.log('start editing');
                        let d = res[0];
                        console.log('imei exist');
                        // d.ownername.push(js.client.username);
                        js.client.data.device.gui = d.gui;
                        js.client.data.device._id = d._id;
                        js.client.data.device._rev = d._rev;
                        d = js.client.data.device;
                        let attach = [];
                        if (js.client.data.device.photo.length > 5) {
                            throw new Error('ERROR too many photo');
                        }
                        //console.log(1443);
                        //let dv: deviceinfo = {} as deviceinfo;
                        //dv = this.cloneObj(d, dv);
                        //dv =d;
                        console.log('updating');
                        this.updateIcemakerDevice(d).then(res => {
                            for (let index = 0; index < js.client.data.device.photo.length; index++) {
                                const element = js.client.data.device.photo[index];
                                attach.push({
                                    name: element.name,
                                    data: element.arraybuffer,
                                    content_type: element.type
                                });
                                element.arraybuffer = '';
                                element.url = '';
                            }
                            this.saveAttachementsToFiles(attach);
                            js.client.data.message = 'OK update devices';
                            //this.filterObject(js.client.data.user);
                            deferred.resolve(js);
                        }).catch(err => {
                            {
                                console.log(err);
                                deferred.reject(err);
                            }
                        });

                    } else {// ADD NEW
                        // js.client.data.deviceinfo.usergui = gui;                        
                        try {
                            console.log('insert new device');
                            let d = {} as deviceinfo;
                            console.log(2060);
                            js.client.data.device.gui = uuidV4();
                            // console.log(2062);
                            // console.log(js.client.data);
                            if (js.client.data.device.imei.length < 12) {
                                console.log("bad  imei");
                                throw new Error('ERROR IMEI length must be 12 or more');
                            } else {
                                console.log('2067');
                                if (!js.client.data.device.name) {
                                    js.client.data.device.name = js.client.data.device.imei;
                                }
                                console.log('2067');
                                if (js.client.data.device.ownername === undefined) {
                                    js.client.data.device.ownername = [];
                                    js.client.data.device.currentownername = js.client.username;
                                }
                                if (js.client.data.device.isactive === undefined) {
                                    js.client.data.device.isactive = true;
                                }
                                js.client.data.device.ownername.push(js.client.username);
                                js.client.data.device.addedtime = (moment().format());
                                js.client.data.device.lastupdate = (moment().format());
                                console.log(2070);
                                let attach = [];
                                if (js.client.data.device.photo === undefined)
                                    js.client.data.device.photo = [];
                                if (js.client.data.device.photo.length > 5) {
                                    throw new Error('ERROR too many photo');
                                }
                                //d = this.cloneObj(js.client.data.device, d);
                                d = js.client.data.device;
                                console.log('start inserting');
                                // console.log(d);
                                this.addIcemakerDevice(d).then(res => {
                                    for (let index = 0; index < js.client.data.device.photo.length; index++) {
                                        const element = js.client.data.device.photo[index];
                                        attach.push({
                                            name: element.name,
                                            data: element.arraybuffer,
                                            content_type: element.type
                                        });
                                        element.arraybuffer = '';
                                        element.url = '';
                                    }
                                    this.saveAttachementsToFiles(attach);
                                    js.client.data.message = 'OK update devices';
                                    this.filterObject(js.client.data.user);
                                    deferred.resolve(js);
                                });
                            }
                        } catch (error) {
                            console.log(error);
                            js.client.data.message = error;
                            deferred.reject(js);
                        }

                    }
                } else {
                    let error = new Error('ERROR res is not an array');
                    console.log(error);
                    js.client.data.message = error;
                    deferred.reject(js);
                }
            });
        } catch (error) {
            console.log(error);
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }
    addIcemakerDevice(o) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_device');
        if (!o.gui) {
            o.gui = uuidV4();
        }
        db.insert(o, o.gui, (err, res) => {
            if (err) deferred.reject(err);
            else {
                deferred.resolve('OK update device');
            }
        });
        return deferred.promise;
    }
    updateIcemakerDevice(o) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_device');
        db.insert(o, o._id, (err, res) => {
            if (err) deferred.reject(err);
            else {
                deferred.resolve('OK update device');
            }
        });
        return deferred.promise;
    }
    setUiMapping(k: string, value: string): void {
        this.r_client.set(this._current_system + '_uuid_' + k, value, 'EX', 60 * 10);
    }
    findDeviceByUsername(username) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_device');
        db.view(this.__design_view, 'findByOwnerName', {
            key: [username + ''],
            include_docs: true
        }, (err, res) => {
            if (err) deferred.reject(err);
            else {
                let arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].doc;
                    //const ui = element.gui;
                    //element.gui=uuidV4();
                    //this.setUiMapping(element.gui,ui);
                    arr.push(element);
                }
                deferred.resolve(arr);
            }
        });
        return deferred.promise;
    }

    findDeviceByImei(imei) {
        let deferred = Q.defer();
        let db = this.create_db('icemaker_device')
        //let imei = js.client.data.deviceinfo.imei;
        db.view(this.__design_view, 'findByImei', {
            key: imei + '',
            include_docs: true
        }, (err, res) => {
            if (err) deferred.reject(err);
            else {
                let arr = [];
                for (let index = 0; index < res.rows.length; index++) {
                    const element = res.rows[index].doc;
                    arr.push(element);
                }
                deferred.resolve(arr);
            }
        });
        return deferred.promise;
    }

    get_device_info_ws(js) {
        let deferred = Q.defer();
        try {
            this.findDeviceByImei(js.client.data.deviceinfo.imei).then(res => {
                js.client.data.deviceinfo = res;
                for (let index = 0; index < js.client.data.deviceinfo.photo.length; index++) {
                    const element = js.client.data.deviceinfo.photo[index];
                    // console.log(`reading file __dirname+'/public/profiles/'+element.name`); 
                    //element.arraybuffer=fs.readFileSync(__dirname+'/public/profiles/'+element.name, "binary");           
                    element.arraybuffer = '/public/profiles/' + element.name;
                }
                deferred.resolve(js);
            });
        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }

        return deferred.promise;
    }
    search_username_ws(js): Q.Promise<any> {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.prefix = 'ice-maker';
        client.data.command = 'search-username';
        client.data.command2 = js.client.data.command;
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            //console.log(b);
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            //delete data.res.SendSMSResult.user_id;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            if (client['command'] !== undefined) {
                parent.setNotificationStatus(client);
            }
            //this.setOnlineStatus(client);                        
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    getUserByLoginToken(js): Q.Promise<any> {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.prefix = 'ice-maker';
        client.data.command = 'find-user-by-logintoken';
        client.data.command2 = js.client.data.command;
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            //delete data.res.SendSMSResult.user_id;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            if (client['command'] !== undefined) {
                // parent.setNotificationStatus(client);
            }
            //this.setOnlineStatus(client);                        
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    getUserByGUI(js): Q.Promise<any> {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.prefix = 'ice-maker';
        client.data.command = 'find-user';
        client.data.command2 = js.client.data.command;
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            //delete data.res.SendSMSResult.user_id;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            if (client['command'] !== undefined) {
                parent.setNotificationStatus(client);
            }
            //this.setOnlineStatus(client);                        
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    get_user_profile_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.prefix = 'ice-maker';
        client.data.command = 'get-profile';
        client.data.command2 = js.client.data.command;
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            //console.log(b);
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            //delete data.res.SendSMSResult.user_id;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            if (client['command'] !== undefined) {
                parent.setNotificationStatus(client);
            }
            //this.setOnlineStatus(client);                        
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    findCurrentUserByGUI(js): Q.Promise<any> {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.prefix = 'ice-maker';
        client.data.command = 'get-user-info';
        client.data.command2 = js.client.data.command;
        let ws_client = new WebSocket(this._usermanager_ws); // user-management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            //console.log(b);
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            //delete data.res.SendSMSResult.user_id;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            if (client['command'] !== undefined) {
                parent.setNotificationStatus(client);
            }
            //this.setOnlineStatus(client);                        
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }

    findUserByManyUsername(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.data.command = 'find-by-many-usernames';
        client.data.command2 = js.client.data.command;
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket('ws://nonav.net:8081/'); // ltcservice
        ws_client.binaryType = 'arraybuffer';
        let parent = this;
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            //console.log(b);
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            if (client['command'] === undefined) {
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            js.client = client;
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }

    findUserByUsername(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        client.data.command = 'find-by-username';
        client.data.command2 = js.client.data.command;
        client.prefix = 'ice-maker';
        let ws_client = new WebSocket(this._usermanager_ws); // user management
        ws_client.binaryType = 'arraybuffer';
        let parent = this;

        console.log('check USERNAME 1');
        ws_client.on('open', () => {
            let b = Buffer.from(JSON.stringify(client)).toString('base64');
            //console.log(b);
            // let a = Buffer.from(b);
            ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                if (err) {
                    console.log(err);
                    parent.setErrorStatus(client);
                    js.client.data.message = err;
                    deferred.reject(js);
                }
            });
        });
        ws_client.on('message', (data) => {
            console.log('check USERNAME 2');
            let b = parent.ab2str(data);
            let s = Buffer.from(b, 'base64').toString();
            client = JSON.parse(s);
            delete client.prefix;
            // console.log(client);
            if (client['command'] === undefined) {
                //client.data.command = js.client.data.command;
                client.data.command = client.data.command2;
                //client.data.message = '';
            }
            js.client = client;
            console.log('check USERNAME');
            //console.log(client);
            ws_client.close();
            deferred.resolve(js)
        });
        ws_client.on("error", (err) => {
            ws_client.close();
            parent.setErrorStatus(client);
            js.client.data.message = err;
            deferred.reject(js);
        });
        return deferred.promise;
    }
    checkAuthorize(js) {
        let deferred = Q.defer();
        deferred.resolve(js); // JUST BY PASS THIS TEMPORARY
        // if (0)
        try {
            let except = ['ping', 'login', 'shake-hands', 'heart-beat'
            ];
            if (except.indexOf(js.client.data.command) > -1) {
                js.client.data.message = 'OK';
                deferred.resolve(js);
            } else {
                this.getUserInfoByLoginToken(js).then(res => {
                    console.log('get GUI ok');
                    // console.log(res['client'].data);
                    js = res;
                    js.client.data.message = 'OK';
                    deferred.resolve(js);
                }).catch(err => {
                    console.log(err); deferred.reject(err);
                })
            }

        } catch (error) {
            js.client.data.message = error;
            deferred.reject(js);
        }
        return deferred.promise;
    }
    getUserInfoByLoginToken(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        // console.log(client.data);
        try {
            client.data.command2 = js.client.data.command;
            client.data.command = 'get-user-gui';
            client.prefix = 'ice-maker';
            client.auth = {};
            let ws_client = new WebSocket(this._usermanager_ws); // user-management
            ws_client.binaryType = 'arraybuffer';
            let parent = this;
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        deferred.reject(err);
                    }
                });
            });
            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                //console.log('get returned gui');
                //console.log(client);
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                js.client = client;
                ws_client.close();
                deferred.resolve(js);

            });
            ws_client.on("error", (err) => {
                ws_client.close();
                //js.client.data.message=err;
                console.log(err);
                parent.setErrorStatus(client);
                deferred.reject(err);

            });
        } catch (error) {
            console.log(error);
            //js.client.data.message=error;
            this.setErrorStatus(client);
            deferred.reject(error);
        }

        return deferred.promise;
    }

    heartbeat_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        deferred.resolve('OK HEART BEAT');
        //console.log(js.client);
        try {
            client.data.command = 'heart-beat';
            client.data.command2 = js.client.data.command;
            client.prefix = 'ice-maker';
            let ws_client = new WebSocket(this._usermanager_ws); // user-management
            ws_client.binaryType = 'arraybuffer';
            let parent = this;
            if (client.logintoken) {
                this.setLoginStatus(client);
            }
            //this.setClientStatus(client);
            ws_client.on('open', () => {
                console.log('heartbeat before');
                //console.log(js.client);
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        deferred.reject(err);
                    }
                });
            });
            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                console.log(js.client);
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                js.client = client;
                console.log('heartbeat');
                //console.log(js.client);
                ws_client.close();
                deferred.resolve(js);
                // } else {
                //     deferred.reject(new Error('Error user not login'))
                // }

            });
            ws_client.on("error", (err) => {
                ws_client.close();
                //js.client.data.message=err;
                parent.setErrorStatus(client);
                deferred.reject(err);

            });
        } catch (error) {
            console.log(error);
            //js.client.data.message=error;
            this.setErrorStatus(client);
            deferred.reject(error);
        }

        return deferred.promise;
    }

    shake_hands_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        console.log('command shake-hands');
        console.log(js.client);
        try {
            client.data.command = 'shake-hands';
            client.data.command2 = js.client.data.command;
            client.prefix = 'ice-maker';
            let ws_client = new WebSocket(this._usermanager_ws); // user-management
            ws_client.binaryType = 'arraybuffer';
            let parent = this;
            // if (client.gui) {
            //     console.log('shake hands');
            //     this.setClientStatus(client);
            // }
            ws_client.on('open', () => {
                console.log('client shake hands');
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // // // let a = Buffer.from(b);
                //console.log(a);        

                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        console.log(err);
                        parent.setErrorStatus(client);
                        deferred.reject(err);
                    }
                });
            });
            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                // console.log(b);
                // console.log(s);
                client = JSON.parse(s);
                // console.log('come from shake hands');
                // console.log(client.auth);
                delete client.prefix;


                if (client['command'] === undefined) {
                    // console.log('2289');
                    // console.log(client);
                    this.setClientStatus(client);
                    //console.log(client);
                    client.data.command = client.data.command2;
                    //client.data.message = '';                    
                }

                js.client = client;
                ws_client.close();
                deferred.resolve(js);
                // } else {
                //     deferred.reject(new Error('Error user not login'))
                // }

            });
            ws_client.on("error", (err) => {
                ws_client.close();
                //js.client.data.message=err;
                parent.setErrorStatus(client);
                deferred.reject(err);

            });
        } catch (error) {
            console.log(error);
            //js.client.data.message=error;
            this.setErrorStatus(client);
            deferred.reject(error);
        }

        return deferred.promise;
    }

    logout_ws(js) {
        let deferred = Q.defer();
        let client = JSON.parse(JSON.stringify(js.client));
        try {
            client.data.command = 'logout';
            client.data.command2 = js.client.data.command;
            client.prefix = 'ice-maker';
            let ws_client = new WebSocket(this._usermanager_ws); // user-management
            ws_client.binaryType = 'arraybuffer';
            let parent = this;
            ws_client.on('open', () => {
                let b = Buffer.from(JSON.stringify(client)).toString('base64');
                //console.log(b);
                // let a = Buffer.from(b);
                ws_client.send(JSON.stringify(b), { binary: true }, (err) => {
                    if (err) {
                        parent.setErrorStatus(client);
                        deferred.reject(err);
                    }
                });
            });
            ws_client.on('message', (data) => {
                let b = parent.ab2str(data);
                let s = Buffer.from(b, 'base64').toString();
                client = JSON.parse(s);
                delete client.prefix;
                if (client['command'] === undefined) {
                    client.data.command = client.data.command2;
                    //client.data.message = '';
                }
                js.client = client;
                this.setClientStatus(client);
                this.setLoginStatus(client);
                ws_client.close();
                deferred.resolve(js);
                // } else {
                //     deferred.reject(new Error('Error user not login'))
                // }

            });
            ws_client.on("error", (err) => {
                ws_client.close();
                //js.client.data.message=err;
                parent.setErrorStatus(client);
                deferred.reject(err);

            });
        } catch (error) {
            console.log(error);
            //js.client.data.message=error;
            this.setErrorStatus(client);
            deferred.reject(error);
        }

        return deferred.promise;
    }

    commandReader(js) {
        const deferred = Q.defer();
        // const isValid=validateTopup(js.client);
        // if(!isValid.length)

        console.log('command: ' + js.client.data.command);
        this.checkAuthorize(js).then(res => {
            //console.log(res);
            switch (js.client.data.command) {
                // case 'refresh-data':
                //     this.refresh_data(js).then(res => {
                //         deferred.resolve(res);
                //     }).catch(err => {
                //         deferred.reject(err);
                //     });
                //     break;
                case 'ping':
                    js.client.data.message += 'OK PONG GPS ບໍ່ໄດ້ ເລີຍບໍ່ທັນ ONLINE ແຕ່ໂທໄດ້, ຕັ້ງຄ່າໄດ້ແລ້ວ';
                    console.log('OK PONG 1');
                    deferred.resolve(js);
                case 'login':
                    this.login_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                // case 'heart-beat':
                //     this.heartbeat_ws(js).then(res => {
                //         deferred.resolve(res);
                //     }).catch(err => {
                //         deferred.reject(err);
                //     });
                //     break;
                case 'shake-hands':
                    // console.log('process shake hands');
                    this.shake_hands_ws(js).then(res => {
                        // console.log('done shake hands');
                        // console.log(res['client'].data);
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'logout':
                    this.logout_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'search-username':
                    this.search_username_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-user-details':
                    this.getUserByGUI(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-profile':
                    this.get_user_profile_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'approve-payment':
                    this.findCurrentUserByGUI(js).then(res => {
                        if (res) {
                            let u = res.client.data.user;
                            if (u.roles.indexOf('admin') > -1 || u.roles.indexOf('finance') > -1 && u.system.indexOf(this._current_system) > -1) {
                                this.approve_payment_ws(js).then(res => {
                                    deferred.resolve(res);
                                }).catch(err => {
                                    deferred.reject(err);
                                });
                            } else {
                                js.client.data.message = ('ERROR there is no permission for this user');
                                deferred.reject(js);
                            };

                        } else {
                            js.client.data.message = ('ERROR there is no this user');
                            deferred.reject(js);
                        }
                    });
                    break;
                case 'get-all-payment':
                    this.findCurrentUserByGUI(js).then(res => {
                        if (res) {
                            let u = res.client.data.user;
                            if (u.roles.indexOf('admin') > -1 || u.roles.indexOf('finace') > -1 && u.system.indexOf(this._current_system) > -1) {
                                this.get_all_payment_ws(js).then(res => {
                                    deferred.resolve(res);
                                }).catch(err => {
                                    deferred.reject(err);
                                });
                            } else {
                                js.client.data.message = ('ERROR there is no permission for this user')
                            };
                            deferred.reject(js);
                        } else {
                            js.client.data.message = ('ERROR there is no this user');
                            deferred.reject(js);
                        }
                    });
                case 'get-payment-list':
                    this.getPaymentList(js).then(res => {
                        deferred.resolve(js);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    // this.get_all_payment_ws(js).then(res => {
                    //     deferred.resolve(res);
                    // }).catch(err => {
                    //     deferred.reject(err);
                    // });                         
                    break;
                case 'make-payment':
                    this.findCurrentUserByGUI(js).then(res => {
                        console.log(5493);
                        console.log(res.data);
                        if (res) {
                            let u = res.client.data.user;
                            console.log(5497);
                            console.log(u);
                            if ((u.roles.indexOf('admin') > -1 || u.roles.indexOf('sale') > -1) && u.system.indexOf(this._current_system) > -1) {
                                this.make_payment_ws(js).then(res => {
                                    deferred.resolve(res);
                                }).catch(err => {
                                    deferred.reject(err);
                                });
                            } else {
                                console.log('HAS NO AUTHORIZE');
                                deferred.reject(new Error('ERROR HAS NO AUTHORIZE'));
                            }
                        } else {
                            js.client.data.message = ('ERROR there is no this user');
                            deferred.reject(js);
                        }
                    });
                    break;
                case 'register-new-user':
                    this.register_new_user_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'register-sale-user':
                    this.register_sale_user_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'register-finance-user':
                    this.register_finance_user_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-devices-owner':
                    this.get_device_list_by_owner_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-devices':
                    console.log('HERE GET DEVICES');
                    this.get_device_list_ws(js).then(res => {
                        //this.get_device_list_by_owner_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-device-info':
                    this.get_device_info_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-sub-users':
                    this.getSubUsers(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break
                case 'update-sub-userinfo':
                    this.update_sub_userinfo_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break
                case 'reset-password-sub-user':
                    this.reset_sub_user_password_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break
                case 'update-devices-owners':
                    this.findCurrentUserByGUI(js).then(res => {
                        if (res) {
                            let u = res.client.data.user;
                            if (u.roles.indexOf('admin') > -1 && u.system.indexOf(this._current_system) > -1) {
                                this.update_icemaker_device_owner_ws(js).then(res => {
                                    deferred.resolve(res);
                                }).catch(err => {
                                    deferred.reject(err);
                                });
                            } else {
                                js.client.data.message = ('ERROR there is no permission for this user')
                            };
                            deferred.reject(js);
                        } else {
                            js.client.data.message = ('ERROR there is no this user');
                            deferred.reject(js);
                        }
                    });
                    break;
                case 'update-devices':
                    console.log('find current user');
                    this.findCurrentUserByGUI(js).then(res => {
                        if (res) {
                            let u = res.client.data.user;
                            try {
                                // console.log('check Authorization')
                                // console.log(u);
                                if (u.roles.indexOf('admin') > -1 && u.system.indexOf(this._current_system) > -1) {
                                    console.log('start update device');
                                    this.update_icemaker_device_ws(js).then(res => {
                                        console.log('update completely');
                                        deferred.resolve(res);
                                    }).catch(err => {
                                        deferred.reject(err);
                                    });
                                } else {
                                    // console.log(2893);
                                    js.client.data.message = 'ERROR there is no permission for this user';
                                    deferred.reject(js);
                                };
                            } catch (error) {
                                // console.log(2899);
                                js.client.data.message = error;
                                deferred.reject(js);
                            }


                        } else {
                            // console.log(2906);
                            js.client.data.message = ('ERROR there is no this user');
                            deferred.reject(js);
                        }
                    });

                    break;

                case 'get-production-time':
                    this.get_production_time_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-production-bills':
                    this.get_production_bills_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-production-details':
                    this.get_production_time_details_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;
                case 'get-latest-working-status':
                    this.get_latest_working_status_ws(js).then(res => {
                        deferred.resolve(res);
                    }).catch(err => {
                        deferred.reject(err);
                    });
                    break;

                default:
                    js.client.data.message = 'ERROR no command';
                    deferred.resolve(js);
                    break;
            }
        });
        return deferred.promise;
    }

    ab2str(arrayBuffer): string {
        let
            binaryString = '';
        const
            bytes = new Uint8Array(arrayBuffer),
            length = bytes.length;
        for (let i = 0; i < length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        return binaryString;
    }

    str2ab(str) {
        const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        const bufView = new Uint8Array(buf);
        for (let i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    heartbeat() {
        this['isAlive'] = true;
        // let parent = this['parent'];
        // //console.log('parent: %s', parent.convertTZ);
        // if (!this['lastupdate'] && !this['gui']) {
        //     // console.log('HEART BEAT:' + this['gui'] + " is alive:" + this['isAlive'] + " " + this['lastupdate'] + " logout");
        //     this['isAlive'] = false;
        // // }
        // let startDate = moment(this['lastupdate'])
        // let endDate = moment(moment.now());

        // const timeout = endDate.diff(startDate, 'seconds');
        // if(this.gui!=this.gui){
        //     this.isAlive=false;
        //     console.log('HEART BEAT:'+this.gui+" is alive:"+this.isAlive+" "+this.lastupdate+" timeout"+timeout);
        //     return;
        // // }
        // if (timeout > 60 * 1)
        //     this['isAlive'] = false;
        // else
        //     this['isAlive'] = true;

        // console.log('HEART BEAT:' + this['gui'] + " is alive:" + this['isAlive'] + " " + this['lastupdate'] + " timeout" + timeout);
        // //this.send(this.client);
    }
    setLoginStatus(client) {
        this.r_client.set(this._current_system + '_login_' + client.logintoken, JSON.stringify({
            command: 'login-changed',
            client: client
        }), 'EX', 60 * 5);
    }

    setClientStatus(client) {
        this.r_client.set(this._current_system + '_client_' + client.gui, JSON.stringify({
            command: 'client-changed',
            client: client
        }), 'EX', 60 * 5);
    }

    setErrorStatus(client) {
        this.r_client.set(this._current_system + '_error_' + client.gui, JSON.stringify({
            command: 'error-changed',
            client: client
        }), 'EX', 60 * 5);
    }

    setNotificationStatus(client) {
        if (client !== undefined) {
            this.r_client.set(this._current_system + '_notification_' + client.gui, JSON.stringify({
                command: 'notification-changed',
                client: client
            }), 'EX', 60 * 30); // client side could not see this , the other server as a client can see this .
        }
    }
    clog(f: string, ...p) {
        console.log(f, p.length ? p : '');
    }
}

export interface deviceinfo {
    _id: string,
    _rev: string,
    gui: string,
    addedtime: Date,
    lastupdated: Date,
    imei: string,
    name: string,
    phonenumber: string;
    currentownername: string,
    ownername: any[],
    photo: any[],
    description: string,
    others: string,
    isactive: boolean,
    "totalrun": "",
    "totalstop": "",
    "totalworking": "",
    "status": any[],

}
export interface icemakerpayment {
    sn: '',
    gui: '',
    bills: any[],//{imei:'',_id:'',gui:'',sn:'',workingtime:0,parking:0,problem:0,rate:0,totalvalue:0,effeciency:0,totalvalue:0,paidtime:''}
    totalvalue: 0,
    totaldiscount: 0,
    totalpaid: 0,
    preparedby: '',
    imei: '',
    invoicetime: '',
    description: '',
    paidby: '',
    username: '',
    paidtime: Date,
    approvedtime: Date,
    isapproved: false,
    approveby: ''
}
export interface icemakerbill {
    day: 0,
    month: 0,
    year: 0,
    lasteststatus: [
        { workingpoints: any[], parkingpoints: any[], problempoints: any[], otherpoints: any[] }],
    productiondetails: any[],
    productiontime: {
        working: 0,
        parking: 0,
        problem: 0
    },
    temps: [
        { hour: 0, temp: 0, wind: 0, outsidetemp: 0, humidity: 0, tempin: 0, tempmax: 0, weathertype: '', weatherdescription: '' }],
    powerconsumption: [{ hour: 0, amp: 0, voltage: 0, watt: 0, pf: 0 }
    ],
    effeciency: 8,
    rate: 250,
    totalvalue: 0,
    imei: '',
    sn: '',
    isdone: false,
    paidtime: '',
    description: '',
    paymentgui: '',
    paidby: '',
    generatedtime: Date,
    gui: '',
    lastupdate: Date[],
}
export interface gijuser {
    username: string;
    password: string;
    phonenumber: number;
    gui: string;
    createddate: Date;
    lastupdate: Date;
    isactive: boolean;
    parents: string[];
    roles: string[];
    logintoken: string;
    expirelogintoken: string;
    description: string;
    photo: string[];
    note: string;
    system: string[];
    gijvalue: number;
    totagij: number;
    totalgijspent: number;
}
export interface billbalance {
    _id: '',
    imei: '',
    totalspent: 0,
    totaldept: 0,
    totaldiscount: 0,
    description: '',
    bills: any[],
    invoices: any[]
}

export default new App();