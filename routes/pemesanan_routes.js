const express = require("express");

const app = express();

app.use(express.json());

var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pemesananController = require("../controller/pemesanan_controller");
const auth = require(`../auth/auth`);
const { checkRole } = require("../middleware/checkRole");

app.get(
  "/getAll",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.getAllPemesanan
);
app.post(
  "/findOne",
  pemesananController.find
);
app.post(
  "/",
  pemesananController.addPemesanan
);
app.post(
  "/manual",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.addPemesananManual
);
app.delete(
  "/:id",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.deletePemesanan
);

app.get(
  "/Month",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.IncomeThisMonth
);

app.post(
  "/print",
  auth.authVerify,
  checkRole(["customer"]),
  pemesananController.PrintPemesanan
);

app.get(
  "/Today",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.IncomeToday
);

app.get(
  "/TransaksiToday",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.getPemesananToday
);

app.get(
  "/TransaksiByDate",
  auth.authVerify,
  checkRole(["admin", "resepsionis"]),
  pemesananController.getPemesananByDate
);

app.post(
  "/doubleRoom",
  auth.authVerify,
  checkRole(["admin", "resepsionis", "customer"]),
  pemesananController.addPemesananNew
);

app.post(
  "/doubleRoomManual",
  auth.authVerify,
  checkRole(["admin", "resepsionis", "customer"]),
  pemesananController.addPemesananNewManual
);

app.post(
  "/VerifyReservation",
  auth.authVerify,
  checkRole(["resepsionis"]),
  pemesananController.verify
);

app.post(
  "/ChangeStatus",
  auth.authVerify,
  checkRole(["resepsionis"]),
  pemesananController.changeStatus
);

app.post(
  "/Reservation",
  // auth.authVerify,
  // checkRole(["customer"]),
  pemesananController.Reservation
);

app.post(
  "/getUserReservation",
  // auth.authVerify,
  // checkRole(["customer"]),
  pemesananController.getPemesananbyEmail
);

app.get(
  "/date/:tgl_check_in/:tgl_check_out",
  // auth.authVerify,
  // checkRole(["customer"]),
  pemesananController.PrintPemesanan
);


module.exports = app;
