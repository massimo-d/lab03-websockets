'use strict';

const Task = require('../components/task');
const User = require('../components/user');
const db = require('../components/db');
var constants = require('../utils/constants.js');


/**
 * Create a new task
 *
 * Input: 
 * - task: the task object that needs to be created
 * - owner: ID of the user who is creating the task
 * Output:
 * - the created task
 **/
exports.addTask = function (task, owner) {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO tasks(description, important, private, project, deadline, completed, owner) VALUES(?,?,?,?,?,?, ?)';
        db.run(sql, [task.description, task.important, task.private, task.project, task.deadline, task.completed, owner], function (err) {
            if (err) {
                reject(err);
            } else {
                var createdTask = new Task(this.lastID, task.description, task.important, task.private, task.deadline, task.project, task.completed, task.active);
                resolve(createdTask);
            }
        });
    });
}


/**
 * Delete a task having taskId as ID
 *
 * Input: 
 * - taskId: the ID of the task that needs to be deleted
 * - owner: ID of the user who is creating the task
 * Output:
 * - no response expected for this operation
 **/
exports.deleteTask = function (taskId, owner) {
    return new Promise((resolve, reject) => {
        const sql1 = "SELECT owner FROM tasks t WHERE t.id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if (owner != rows[0].owner) {
                reject(403);
            }
            else {
                const sql2 = 'DELETE FROM assignments WHERE task = ?';
                db.run(sql2, [taskId], (err) => {
                    if (err)
                        reject(err);
                    else {
                        const sql3 = 'DELETE FROM tasks WHERE id = ?';
                        db.run(sql3, [taskId], (err) => {
                            if (err)
                                reject(err);
                            else
                                resolve(null);
                        })
                    }
                })
            }
        });
    });
}


/**
 * Retrieve the public tasks
 * 
 * Input: 
 * - req: the request of the user
 * Output:
 * - list of the public tasks
 * 
 **/
exports.getPublicTasks = function (req) {
    return new Promise((resolve, reject) => {

        var sql = "SELECT t.id as tid, t.description, t.important, t.private, t.project, t.deadline,t.completed,t.completers, c.total_rows FROM tasks t, (SELECT count(*) total_rows FROM tasks l WHERE l.private=0) c WHERE  t.private = 0 "
        var limits = getPagination(req);
        if (limits.length != 0) sql = sql + " LIMIT ?,?";
        db.all(sql, limits, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let tasks = rows.map((row) => createTask(row));
                resolve(tasks);
            }
        });
    });
}

/**
 * Retrieve the number of public tasks
 * 
 * Input: 
 * - none
 * Output:
 * - total number of public tasks
 * 
 **/
exports.getPublicTasksTotal = function () {
    return new Promise((resolve, reject) => {
        var sqlNumOfTasks = "SELECT count(*) total FROM tasks t WHERE  t.private = 0 ";
        db.get(sqlNumOfTasks, [], (err, size) => {
            if (err) {
                reject(err);
            } else {
                resolve(size.total);
            }
        });
    });
}


/**
 * Retrieve the task having taskId as ID
 *
 * Input: 
 * - taskId: the ID of the task that needs to be retrieved
 * - owner: ID of the user who is retrieving the task
 * Output:
 * - the requested task
 * 
 **/
exports.getSingleTask = function (taskId, owner) {
    return new Promise((resolve, reject) => {
        const sql1 = "SELECT id as tid, description, important, private, project, deadline, completed, owner, completers FROM tasks WHERE id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if (rows[0].owner == owner) {
                var task = createTask(rows[0]);
                resolve(task);
            }
            else {
                const sql2 = "SELECT t.id as total FROM tasks as t, assignments as a WHERE t.id = a.task AND t.id = ? AND a.user = ? ";
                db.all(sql2, [taskId, owner], (err, rows2) => {
                    if (rows2.length === 0) {
                        reject(403);
                    }
                    else {
                        var task = createTask(rows[0]);
                        resolve(task);
                    }
                });
            }
        });
    });
}


/**
 * Retreve the tasks created by the user
 * 
 * Input: 
 * -req: the request of the user
 * Output:
 * - the list of owned tasks
 * 
 **/
exports.getOwnedTasks = function (req) {
    return new Promise((resolve, reject) => {
        var sql = "SELECT t.id as tid, t.description, t.important, t.private, t.project, t.deadline,t.completed FROM tasks as t WHERE t.owner = ?";
        var limits = getPagination(req);
        if (limits.length != 0) sql = sql + " LIMIT ?,?";
        limits.unshift(req.user);

        db.all(sql, limits, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let tasks = rows.map((row) => createTask(row));
                resolve(tasks);
            }
        });
    });
}



/**
 * Retreve the tasks assigned to the user
 * 
 * Input: 
 * - req: the request of the user
 * Output:
 * - the list of assigned tasks
 * 
 **/
exports.getAssignedTasks = function (req) {
    return new Promise((resolve, reject) => {
        var sql = "SELECT t.id as tid, t.description, t.important, t.private, t.project, t.deadline,t.completed,a.active, u.id as uid, u.name, u.email FROM tasks as t, users as u, assignments as a WHERE t.id = a.task AND a.user = u.id AND u.id = ?";
        var limits = getPagination(req);
        if (limits.length != 0) sql = sql + " LIMIT ?,?";
        limits.unshift(req.user);

        db.all(sql, limits, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let tasks = rows.map((row) => createTask(row));
                resolve(tasks);
            }
        });
    });
}


/**
 * Retrieve the number of owned tasks
 * 
 * Input: 
 * - req: the request of the user
 * Output:
 * - total number of owned tasks
 * 
 **/
exports.getOwnedTasksTotal = function (req) {
    return new Promise((resolve, reject) => {
        var sqlNumOfTasks = "SELECT count(*) total FROM tasks as t WHERE t.owner = ?";
        db.get(sqlNumOfTasks, req.user, (err, size) => {
            if (err) {
                reject(err);
            } else {
                resolve(size.total);
            }
        });
    });
}

/**
 * Retrieve the number of assigned tasks
 * 
 * Input: 
 * - req: the request of the user
 * Output:
 * - total number of assigned tasks
 * 
 **/
exports.getAssignedTasksTotal = function (req) {
    return new Promise((resolve, reject) => {
        var sqlNumOfTasks = "SELECT count(*) total FROM tasks as t, users as u, assignments as a WHERE t.id = a.task AND a.user = u.id AND u.id = ?";
        db.get(sqlNumOfTasks, req.user, (err, size) => {
            if (err) {
                reject(err);
            } else {
                resolve(size.total);
            }
        });
    });
}


/**
 * Update a task
 *
 * Input:
 * - task: new task object
 * - taskID: the ID of the task to be updated
 * - owner: the ID of the user who wants to update the task
 * Output:
 * - no response expected for this operation
 * 
 **/
exports.updateSingleTask = function (task, taskId, owner) {
    return new Promise((resolve, reject) => {

        const sql1 = "SELECT owner FROM tasks t WHERE t.id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if (owner != rows[0].owner) {
                reject(403);
            }
            else {
                const sql2 = 'DELETE FROM assignments WHERE task = ?';
                db.run(sql2, [taskId], (err) => {
                    if (err)
                        reject(err);
                    else {
                        var sql3 = 'UPDATE tasks SET description = ?, completed = 0';
                        var parameters = [task.description];
                        if (task.important != undefined) {
                            sql3 = sql3.concat(', important = ?');
                            parameters.push(task.important);
                        }
                        if (task.private != undefined) {
                            sql3 = sql3.concat(', private = ?');
                            parameters.push(task.private);
                        }
                        if (task.project != undefined) {
                            sql3 = sql3.concat(', project = ?');
                            parameters.push(task.project);
                        }
                        if (task.deadline != undefined) {
                            sql3 = sql3.concat(', deadline = ?');
                            parameters.push(task.deadline);
                        }
                        if (task.completers != undefined){
                            sql3 = sql3.concat(', completers = ?');
                            parameters.push(task.completers);
                        }
                        sql3 = sql3.concat(' WHERE id = ?');
                        parameters.push(taskId);

                        db.run(sql3, parameters, function (err) {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(null);
                            }

                        })
                    }
                })
            }
        });
    });
}


/**
 * Complete a task 
 *
 * Input:
 * - taskID: the ID of the task to be completed
 * - assignee: the ID of the user who wants to complete the task
 * Output:
 * - null
 * 
 **/
exports.completeUserTask = function (taskId, userId) {
    return new Promise((resolve, reject) => {
        const sql1 = "SELECT * FROM tasks t WHERE t.id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else {
                const sql2 = "SELECT * FROM assignments a WHERE a.user = ? AND a.task = ?";
                db.all(sql2, [userId, taskId], (err, rows2) => {
                    if (err)
                        reject(err);
                    else if (rows2.length === 0)
                        reject(403);
                    else if(rows2[0].completed === 1) 
                        reject(400);
                    else {
                        const sql3 = "UPDATE assignments SET completed = 1 WHERE user = ? AND task = ?";
                        db.run(sql3, [userId, taskId], function (err) {
                            if (err)
                                reject(err);
                            else {
                                const sql4 = 'SELECT COUNT(*) as tot FROM assignments WHERE task = ? AND completed = 1';
                                db.get(sql4, [taskId], (err, size) => {
                                    if (err)
                                        reject(err);
                                    else {
                                        if (rows[0].completers === size.tot) {
                                            const sql5 = 'UPDATE tasks SET completed = 1 WHERE id = ?';
                                            db.run(sql5, [taskId], function (err1) {
                                                if (err1) {
                                                    reject(err1);
                                                } else {
                                                    resolve(null);
                                                }
                                            });
                                        }
                                        else
                                            resolve(null);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
};


exports.getSelectors = function (taskId, owner) {
    return new Promise((resolve, reject) => {

        const sql1 = "SELECT owner FROM tasks t WHERE t.id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if (owner != rows[0].owner) {
                reject(403);
            }
            else {
                const sql2 = "SELECT u.id as uid, u.name, u.email FROM assignments as a, users as u WHERE  a.task = ? AND a.user = u.id AND a.active = 1";
                db.all(sql2, [taskId], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        let selectors = rows.map((row) => new User(row.uid, row.name, row.email, null));
                        resolve(selectors);
                    }
                });
            }
        });
    });
}


/**/
exports.getCompleters = function (taskId, owner) {
    return new Promise((resolve, reject) => {

        const sql1 = "SELECT owner, completers FROM tasks t WHERE t.id = ?";
        db.all(sql1, [taskId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if (owner != rows[0].owner) {
                reject(403);
            }
            else {
                const sql2 = "SELECT u.id as uid, u.name, u.email FROM assignments as a, users as u WHERE  a.task = ? AND a.user = u.id AND a.completed = 1";
                db.all(sql2, [taskId], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        let completers = rows.map((row) => new User(row.uid, row.name, row.email, null));
                        resolve(completers);
                    }
                });
            }
        });
    });
}



/**
 * Utility functions
 */
const getPagination = function (req) {
    var pageNo = parseInt(req.query.pageNo);
    var size = constants.OFFSET;
    var limits = [];
    if (req.query.pageNo == null) {
        pageNo = 1;
    }
    limits.push(size * (pageNo - 1));
    limits.push(size);
    return limits;
}

const createTask = function (row) {
    const importantTask = (row.important === 1) ? true : false;
    const privateTask = (row.private === 1) ? true : false;
    const completedTask = (row.completed === 1) ? true : false;
    return new Task(row.tid, row.description, importantTask, privateTask, row.deadline, row.project, completedTask, row.active, row.completers);
}
