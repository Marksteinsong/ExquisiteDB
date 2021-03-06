const ExquisiteDB=function (databaseName,version,dataConstruct) {
    //不对外开放的接口
    const isSupported=function () {return !window.indexedDB?false:true;};
    const init=function () {
        window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
        window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
    };
    const isDSValid=function(o){
        return o.hasOwnProperty("keyPath")&&o.index.length>0;
    };

    if(!isDSValid(dataConstruct)){console.log("数据结构无效");return}
    if(!isSupported()){console.log("你的浏览器不支持indexDB!");return}
    if((typeof databaseName)!=="string"){console.log("ExquisiteDB:数据库名必须是string。");return;}

    //indexDB变量初始化
    init();

    this.databaseName=databaseName;
    this.version=version;
    this.request = window.indexedDB.open(this.databaseName,this.version);
    //本地不存在数据库，创建数据库
    this.request.onupgradeneeded=function (event) {
        //console.log("创建新结构。");
        const db = event.target.result;
        //keyPath主键
        const  objectStore = db.createObjectStore("ExquisiteDB", { keyPath: dataConstruct.keyPath });
        dataConstruct.index.forEach(function (index) {
            objectStore.createIndex(index.name, index.name, { unique: index.unique });
            //console.log(index);
        });
        // 使用事务的 oncomplete 事件确保在插入数据前对象仓库已经创建完毕
        objectStore.transaction.oncomplete = function(event) {
            console.log("数据库创建：",event.type);
        };
    }
};
ExquisiteDB.prototype={
    constructor:ExquisiteDB,
    //开启事务
    entry:function(){
        return new Promise(resolve => {
            const request=window.indexedDB.open(this.databaseName,this.version);
            request.onsuccess=function (event) {
                const db=event.target.result;
                const  objectStore = db.transaction(["ExquisiteDB"], "readwrite").objectStore("ExquisiteDB");
                resolve({result:true,objectStore});
            };
            request.onerror=function (event) {
                resolve({result:false,message:"打开数据库失败"});
            }
        })
    },
    /**读取*/
    //读取所有
    getAll:function () {
        return new Promise(resolve => {
            const request=window.indexedDB.open(this.databaseName,this.version);
            request.onsuccess=function (event) {
                const db=event.target.result;
                const  objectStore = db.transaction("ExquisiteDB").objectStore("ExquisiteDB");
                objectStore.getAll().onsuccess = function(event) {
                    resolve({data:event.target.result,result:true});
                };
            };
            request.onerror=function (event) {
                resolve({result:false,message:"打开数据库失败"});
            }
        });
    },
    //根据根据键值读取  ex.  "name","mark"
    getItemByIndex:function(index,value){
        return new Promise(resolve => {
            this.entry().then(result=>{
                const  request = result.objectStore.index(index);
                request.get(value).onsuccess=function (event) {
                    resolve({data:event.target.result,result:true});
                }
            });
        })
    },
    getItemsByIndex:function(index,value){
        return new Promise(resolve => {
            this.entry().then(result=>{
                const data=[];
                const  request = result.objectStore.index(index);
                const singleKeyRange = IDBKeyRange.only(value);
                request.openCursor(singleKeyRange).onsuccess=function () {
                    const cursor = event.target.result;
                    if (cursor) {
                        data.push(cursor.value);
                        cursor.continue();
                    }
                    else {
                        resolve({data,result:true});
                    }
                };
            })
        })
    },
    //根据主键读取
    getItemByKeyPath:function(keyPath){
        return new Promise(resolve => {
            this.entry().then(result=>{
                const request = result.objectStore.get(keyPath);
                request.onsuccess=function (event) {
                    const data = event.target.result;
                    data?resolve({data:data,result:true}):resolve({data:[],result:false});
                }
            })
        })
    },
    //写
    add:function(data){
        return new Promise(resolve => {
            this.entry().then(result=>{
                const request=result.objectStore.add(data);
                request.onsuccess=function (event) {
                    resolve({result:event.type==="success"});
                };
                request.onerror=function (event) {
                    resolve({message:`写入失败:${event.target.error.message}`,result:false});
                }
            })
        })
    },
    //删
    removeByKeyPath:function(keyPath){
        return new Promise(resolve => {
            this.entry().then(result=>{
                const request=result.objectStore.delete(keyPath);
                request.onsuccess=function(event){
                    resolve({result:event.type==="success"});
                };
                request.onerror=function (event) {
                    resolve({message:`删除失败:${event.target.error.message}`,result:false});
                }
            })
        });
    },
    //改
    changeByKeyPath:function (keyPath,dataChanged) {
        return new Promise(resolve => {
            this.entry().then(result=>{
                const request = result.objectStore.get(keyPath);
                request.onerror = function(event) {
                    resolve({data:`读取失败:${event.target.error.message}`,result:false});
                };
                request.onsuccess = function(event) {
                    // 获取想要更新的数据
                    const oldData = event.target.result;
                    if(!oldData){resolve({result:false,message:"keyPath不存在"});return ;}
                    //  oldData 与  dataChanged  对比更改 有且不同的、没有的
                    const generate=function (chang,old) {
                        const ck=Object.keys(chang);
                        ck.map(function (key) {
                            //有且不同的、没有的->添加到old
                            !old.hasOwnProperty(key)
                                ?old[key]=chang[key]
                                :(
                                    old[key]===chang[key]
                                        ?""
                                        :old[key]=chang[key]
                                );
                        });
                        return old;
                    };
                    const  newData=generate(dataChanged,oldData);

                    // 把更新过的对象放回数据库
                    const  requestUpdate = result.objectStore.put(newData);
                    requestUpdate.onerror = function(event) {
                        resolve({data:`更改失败:${event.target.error.message}`,result:false});
                    };
                    requestUpdate.onsuccess = function(event) {
                        resolve({result:event.type==="success"});
                    };
                };
            })
        })
    },
};
