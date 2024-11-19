const express = require('express')
var body = require("body-parser");

const app = express()

app.use(express.json())


const userController = require("../controller/user_controller");
const auth = require(`../auth/auth`)
const { checkRole } = require("../middleware/checkRole");


app.post("/login", userController.login)
app.get("/getAll", auth.authVerify,userController.getAllUser)
app.get("/findOne/:id", auth.authVerify, checkRole(["admin","resepsionis"]),userController.findUser)
app.post("/register",  userController.addUser) 
app.delete("/:id", auth.authVerify, checkRole(["admin"]),userController.deleteUser)
app.put("/:id_user",auth.authVerify, checkRole(["admin"]), userController.updateUser)
app.get("/findAllCustomer", userController.findAllCustomer)
app.get("/findAllExcCustomer", userController.findAllExcCustomer)
app.post("/RegisterCustomer", userController.RegisterCustomer)
app.post("/RegisterLoginCustomer", userController.LoginRegister)
app.get("/getUserCount", userController.getUserLength)



module.exports=app