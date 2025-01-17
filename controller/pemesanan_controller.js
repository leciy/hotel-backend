const pemesananModel = require(`../models/index`).pemesanan;
const detailsOfPemesananModel = require(`../models/index`).detail_pemesanan;
const userModel = require(`../models/index`).user;
const roomModel = require(`../models/index`).kamar;
const tipeModel = require(`../models/index`).tipe_kamar;
const moment = require("moment");
const randomstring = require("randomstring");

const Op = require(`sequelize`).Op;
const Sequelize = require("sequelize");
const sequelize = new Sequelize("hotel_ukk", "root", "", {
  host: "localhost",
  dialect: "mysql",
});

//tambah data
exports.addPemesanan = async (request, response) => {
  //cek nama_user
  let nama_user = request.body.nama_user;
  let userId = await userModel.findOne({
    where: {
      [Op.and]: [{ nama_user: { [Op.substring]: nama_user } }],
    },
  });
  if (userId === null) {
    return response.status(400).json({
      success: false,
      message: `User yang anda inputkan tidak ada`,
    });
  } else {
    //tanggal pemesanan sesuai tanggal hari ini + random string
    let date = moment();
    let tgl_pemesanan = date.format("YYYY-MM-DD");
    const random = randomstring.generate(7);
    let nomorPem = `${tgl_pemesanan}_${random}`;
    console.log(tgl_pemesanan);

    let check_in = request.body.check_in;
    let check_out = request.body.check_out;
    const date1 = moment(check_in);
    const date2 = moment(check_out);

    if (date2.isBefore(date1)) {
      return response.status(400).json({
        success: false,
        message: "masukkan tanggal yang benar",
      });
    }
    let tipe_kamar = request.body.tipe_kamar;

    let tipeRoomCheck = await tipeModel.findOne({
      where: {
        [Op.and]: [{ nama_tipe_kamar: tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });

    if (tipeRoomCheck === null) {
      return response.status(400).json({
        success: false,
        message: `Tidak ada tipe kamar dengan nama itu`,
      });
    }
    //mendapatkan kamar yang available di antara tanggal check in dan check out sesuai dengan tipe yang diinput user
    const result = await sequelize.query(
      `SELECT tipe_kamars.nama_tipe_kamar, kamars.nomor_kamar 
FROM kamars 
LEFT JOIN tipe_kamars ON kamars.id_tipe_kamar = tipe_kamars.id 
LEFT JOIN detail_pemesanans ON detail_pemesanans.id_kamar = kamars.id 
WHERE kamars.id NOT IN (
    SELECT id_kamar 
    FROM detail_pemesanans 
    WHERE tgl_akses BETWEEN '${check_in}' AND '${check_out}'
) 
AND tipe_kamars.nama_tipe_kamar = '${tipe_kamar}' 
GROUP BY tipe_kamars.nama_tipe_kamar, kamars.nomor_kamar;`
    );
    //cek apakah ada
    if (result[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: `Kamar dengan tipe itu dan di tanggal itu sudah terbooking`,
      });
    }

    //masukkan nomor kamar ke dalam array kemudian random memilih
    const array = [];
    for (let index = 0; index < result[0].length; index++) {
      array.push(result[0][index].nomor_kamar);
    }
    
    const randomElement = Number(array[array.length - 1]);
    console.log("ini random element ", randomElement);

    let room = await roomModel.findOne({
      where: {
        [Op.and]: [{ nomor_kamar: randomElement }],
      },
      attributes: [
        "id",
        "nomor_kamar",
        "id_tipe_kamar",
        "createdAt",
        "updatedAt",
      ],
    });

    let roomPrice = await tipeModel.findOne({
      where: {
        [Op.and]: [{ id: room.id_tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });

    let newData = {
      nomor_pemesanan: nomorPem,
      nama_pemesanan: request.body.nama_pemesanan,
      email_pemesanan: request.body.email_pemesanan,
      tgl_pemesanan: tgl_pemesanan,
      tgl_check_in: check_in,
      tgl_check_out: check_out,
      nama_tamu: request.body.nama_tamu,
      jumlah_kamar: 1,
      id_tipe_kamar: room.id_tipe_kamar,
      status_pemesanan: request.body.status,
      id_user: userId.id,
    };

    //menetukan harga dengan cara mengali selisih tanggal check in dan check out dengan harga tipe kamar
    const startDate = moment(newData.tgl_check_in);
    const endDate = moment(newData.tgl_check_out);
    const duration = moment.duration(endDate.diff(startDate));
    const nights = duration.asDays();
    const harga = nights * roomPrice.harga;

    //cek jika ada inputan kosong
    for (const [key, value] of Object.entries(newData)) {
      if (!value || value === "") {
        console.log(`Error: ${key} is empty`);
        return response
          .status(400)
          .json({ error: `${key} kosong mohon di isi` });
      }
    }

    pemesananModel
      .create(newData)
      .then((result) => {
        let pemesananID = result.id;

        let tgl1 = new Date(result.tgl_check_in);
        let tgl2 = new Date(result.tgl_check_out);
        let checkIn = moment(tgl1).format("YYYY-MM-DD");
        let checkOut = moment(tgl2).format("YYYY-MM-DD");

        // check if the dates are valid
        let success = true;
        let message = "";

        //looping detail pemesanan anatar tanggal check in sampai 1 hari sebelum check out agara mudah dalam cek available
        for (
          let m = moment(checkIn, "YYYY-MM-DD");
          m.isBefore(checkOut);
          m.add(1, "days")
        ) {
          let date = m.format("YYYY-MM-DD");
          let newDetail = {
            id_pemesanan: pemesananID,
            id_kamar: room.id,
            tgl_akses: date,
            harga: harga,
          };
          console.log(m);
          detailsOfPemesananModel
            .bulkCreate([newDetail])
            .then(async (resultss) => {
              let result = []
          let query = await sequelize.query(
            `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${pemesananID} GROUP BY kamars.id ORDER BY kamars.id DESC`
          );
          result.push(query[0]);
          let data = [];

          for (let index = 0; index < result[0].length; index++) {
            const getNomorKamar = await sequelize.query(
              `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
            );
            // console.log("ll",getNomorKamar);
            data.push({
              id: result[0][index].id,
              nama_pemesanan: result[0][index].nama_pemesanan,
              email_pemesanan: result[0][index].email_pemesanan,
              tgl_pemesanan: result[0][index].tgl_pemesanan,
              tgl_check_in: result[0][index].tgl_check_in,
              tgl_check_out: result[0][index].tgl_check_out,
              nama_tamu: result[0][index].nama_tamu,
              jumlah_kamar: result[0][index].jumlah_kamar,
              harga: result[0][index].harga,
              status_pemesanan: result[0][index].status_pemesanan,
              nama_user: result[0][index].nama_user,
              nama_tipe_kamar: result[0][index].nama_tipe_kamar,
              nomor_kamar: getNomorKamar[0],
            });
            // nomorKamar.pop();
          }
          return response.json({
            success: true,
            data: data,
            message: `Transaction have been insert`,
          });
            })
            .catch((error) => {
              success = false;
              message = error.message;
            });
        }
      })
      .catch((error) => {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      });
  }
};

exports.addPemesananManual = async (request, response) => {
  //cek nama_user
  let nama_user = request.body.nama_user;
  let userId = await userModel.findOne({
    where: {
      [Op.and]: [{ nama_user: { [Op.substring]: nama_user } }],
    },
  });
  if (userId === null) {
    return response.status(400).json({
      success: false,
      message: `User yang anda inputkan tidak ada`,
    });
  } else {
    //tanggal pemesanan sesuai tanggal hari ini + random string
    let date = moment();
    let tgl_pemesanan = date.format("YYYY-MM-DD");
    const random = randomstring.generate(7);
    let nomorPem = `${tgl_pemesanan}_${random}`;
    console.log(tgl_pemesanan);

    let check_in = request.body.check_in;
    let check_out = request.body.check_out;
    const date1 = moment(check_in);
    const date2 = moment(check_out);

    if (date2.isBefore(date1)) {
      return response.status(400).json({
        success: false,
        message: "masukkan tanggal yang benar",
      });
    }
    let tipe_kamar = request.body.tipe_kamar;

    let tipeRoomCheck = await tipeModel.findOne({
      where: {
        [Op.and]: [{ nama_tipe_kamar: tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });
    console.log(tipeRoomCheck);
    if (tipeRoomCheck === null) {
      return response.status(400).json({
        success: false,
        message: `Tidak ada tipe kamar dengan nama itu`,
      });
    }

    let nomor_kamar = request.body.nomor_kamar;

    let room = await roomModel.findOne({
      where: {
        [Op.and]: [
          { nomor_kamar: nomor_kamar },
          { id_tipe_kamar: tipeRoomCheck.id },
        ],
      },
      attributes: [
        "id",
        "nomor_kamar",
        "id_tipe_kamar",
        "createdAt",
        "updatedAt",
      ],
    });

    // console.log(room);
    if (room === null) {
      return response.status(400).json({
        success: false,
        message: `Kamar dengan nomor itu tidak ada`,
      });
    }

    let roomPrice = await tipeModel.findOne({
      where: {
        [Op.and]: [{ id: room.id_tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });

    let newData = {
      nomor_pemesanan: nomorPem,
      nama_pemesanan: request.body.nama_pemesanan,
      email_pemesanan: request.body.email_pemesanan,
      tgl_pemesanan: tgl_pemesanan,
      tgl_check_in: check_in,
      tgl_check_out: check_out,
      nama_tamu: request.body.nama_tamu,
      jumlah_kamar: 1,
      id_tipe_kamar: room.id_tipe_kamar,
      status_pemesanan: request.body.status,
      id_user: userId.id,
    };

    let roomCheck = await sequelize.query(
      `SELECT * FROM detail_pemesanans WHERE id_kamar = '${room.id}' AND tgl_akses BETWEEN '${newData.tgl_check_in}' AND '${newData.tgl_check_out}'`
    );

    if (roomCheck[0].length > 0) {
      return response.status(400).json({
        success: false,
        message: `Kamar dengan nomor itu sudah di booking di hari itu`,
      });
    }

    //menetukan harga dengan cara mengali selisih tanggal check in dan check out dengan harga tipe kamar
    const startDate = moment(newData.tgl_check_in);
    const endDate = moment(newData.tgl_check_out);
    const duration = moment.duration(endDate.diff(startDate));
    const nights = duration.asDays();
    const harga = nights * roomPrice.harga;

    //cek jika ada inputan kosong
    for (const [key, value] of Object.entries(newData)) {
      if (!value || value === "") {
        console.log(`Error: ${key} is empty`);
        return response
          .status(400)
          .json({ error: `${key} kosong mohon di isi` });
      }
    }

    pemesananModel
      .create(newData)
      .then((result) => {
        let pemesananID = result.id;

        let tgl1 = new Date(result.tgl_check_in);
        let tgl2 = new Date(result.tgl_check_out);
        let checkIn = moment(tgl1).format("YYYY-MM-DD");
        let checkOut = moment(tgl2).format("YYYY-MM-DD");

        // check if the dates are valid
        let success = true;
        let message = "";

        //looping detail pemesanan anatar tanggal check in sampai 1 hari sebelum check out agara mudah dalam cek available
        for (
          let m = moment(checkIn, "YYYY-MM-DD");
          m.isBefore(checkOut);
          m.add(1, "days")
        ) {
          let date = m.format("YYYY-MM-DD");
          let newDetail = {
            id_pemesanan: pemesananID,
            id_kamar: room.id,
            tgl_akses: date,
            harga: harga,
          };
          console.log(m);

          detailsOfPemesananModel
            .bulkCreate([newDetail])
            .then(async (resultss) => {
              let result = []
              let query = await sequelize.query(
                `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${pemesananID} GROUP BY kamars.id ORDER BY kamars.id DESC`
              );
              result.push(query[0]);
              let data = [];
    
              for (let index = 0; index < result[0].length; index++) {
                const getNomorKamar = await sequelize.query(
                  `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
                );
                // console.log("ll",getNomorKamar);
                data.push({
                  id: result[0][index].id,
                  nama_pemesanan: result[0][index].nama_pemesanan,
                  email_pemesanan: result[0][index].email_pemesanan,
                  tgl_pemesanan: result[0][index].tgl_pemesanan,
                  tgl_check_in: result[0][index].tgl_check_in,
                  tgl_check_out: result[0][index].tgl_check_out,
                  nama_tamu: result[0][index].nama_tamu,
                  jumlah_kamar: result[0][index].jumlah_kamar,
                  harga: result[0][index].harga,
                  status_pemesanan: result[0][index].status_pemesanan,
                  nama_user: result[0][index].nama_user,
                  nama_tipe_kamar: result[0][index].nama_tipe_kamar,
                  nomor_kamar: getNomorKamar[0],
                });
                // nomorKamar.pop();
              }
              return response.json({
                success: true,
                data: data,
                message: `Transaction have been insert`,
              });
            })
            .catch((error) => {
              success = false;
              message = error.message;
            });
        }
      })
      .catch((error) => {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      });
  }
};

//delete data
exports.deletePemesanan = async (request, response) => {
  let pemesananID = request.params.id;
  let getId = await pemesananModel.findAll({
    where: {
      [Op.and]: [{ id: pemesananID }],
    },
    attributes: [
      "id",
      "nomor_pemesanan",
      "nama_pemesanan",
      "email_pemesanan",
      "tgl_pemesanan",
      "tgl_check_in",
      "tgl_check_out",
      "nama_tamu",
      "jumlah_kamar",
      "id_tipe_kamar",
      "id_user",
      "createdAt",
      "updatedAt",
    ],
  });
  if (getId.length === 0) {
    return response.json({
      success: false,
      message: "Transaksi dengan id tersebut tidak ada",
    });
  }

  detailsOfPemesananModel
    .destroy({
      where: { id_pemesanan: pemesananID },
    })
    .then((result) => {
      pemesananModel
        .destroy({ where: { id: pemesananID } })
        .then((result) => {
          return response.json({
            success: true,
            message: `Transaction has been deleted`,
          });
        })
        .catch((error) => {
          return response.json({
            success: false,
            message: error.message,
          });
        });
    })
    .catch((error) => {
      return response.json({
        success: false,
        message: error.message,
      });
    });
};

//mendapatkan semua data
exports.getAllPemesanan = async (request, response) => {
  const result = await sequelize.query(
    "SELECT pemesanans.id,pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan,users.nama_user,tipe_kamars.nama_tipe_kamar,kamars.nomor_kamar,detail_pemesanans.harga FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id = pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar GROUP BY pemesanans.id ORDER BY pemesanans.id DESC;"
  );
  if (result[0].length === 0) {
    return response.status(400).json({
      success: false,
      message: "nothing transaksi to show",
    });
  }
  const data = [];

  for (let index = 0; index < result[0].length; index++) {
    const getNomorKamar = await sequelize.query(
      `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
    );
    data.push({
      id: result[0][index].id,
      nama_pemesanan: result[0][index].nama_pemesanan,
      email_pemesanan: result[0][index].email_pemesanan,
      tgl_pemesanan: result[0][index].tgl_pemesanan,
      tgl_check_in: result[0][index].tgl_check_in,
      tgl_check_out: result[0][index].tgl_check_out,
      nama_tamu: result[0][index].nama_tamu,
      nomor_pemesanan: result[0][index].nomor_pemesanan,
      jumlah_kamar: result[0][index].jumlah_kamar,
      harga: result[0][index].harga,
      status_pemesanan: result[0][index].status_pemesanan,
      nama_user: result[0][index].nama_user,
      nama_tipe_kamar: result[0][index].nama_tipe_kamar,
      nomor_kamar: getNomorKamar[0],
    });
    // nomorKamar.pop();
  }

  response.json({
    success: true,
    data: data,
    message: `All Transaction have been loaded`,
  });
};

//mendapatkan semua data
exports.getPemesananToday = async (request, response) => {
  const result = await sequelize.query(
    `SELECT 
    pemesanans.id,
    pemesanans.nama_pemesanan,
    pemesanans.email_pemesanan,
    pemesanans.tgl_pemesanan,
    pemesanans.tgl_check_in,
    pemesanans.tgl_check_out,
    pemesanans.nama_tamu,
    pemesanans.jumlah_kamar,
    pemesanans.status_pemesanan,
    users.nama_user,
    tipe_kamars.nama_tipe_kamar,
    kamars.nomor_kamar,
    detail_pemesanans.harga 
FROM 
    pemesanans 
JOIN 
    tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar 
LEFT JOIN 
    users ON users.id = pemesanans.id_user 
JOIN 
    detail_pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id 
JOIN 
    kamars ON kamars.id = detail_pemesanans.id_kamar 
WHERE 
    DATE(pemesanans.tgl_pemesanan) = CURDATE() 
GROUP BY 
    pemesanans.id 
ORDER BY 
    pemesanans.id DESC;`
  );
  if (result[0].length === 0) {
    return response.status(400).json({
      success: false,
      message: "nothing transaksi to show",
    });
  }
  const data = [];

  for (let index = 0; index < result[0].length; index++) {
    const getNomorKamar = await sequelize.query(
      `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
    );
    data.push({
      id: result[0][index].id,
      nama_pemesanan: result[0][index].nama_pemesanan,
      email_pemesanan: result[0][index].email_pemesanan,
      tgl_pemesanan: result[0][index].tgl_pemesanan,
      tgl_check_in: result[0][index].tgl_check_in,
      tgl_check_out: result[0][index].tgl_check_out,
      nama_tamu: result[0][index].nama_tamu,
      nomor_pemesanan: result[0][index].nomor_pemesanan,
      jumlah_kamar: result[0][index].jumlah_kamar,
      harga: result[0][index].harga,
      status_pemesanan: result[0][index].status_pemesanan,
      nama_user: result[0][index].nama_user,
      nama_tipe_kamar: result[0][index].nama_tipe_kamar,
      nomor_kamar: getNomorKamar[0],
    });
    // nomorKamar.pop();
  }

  response.json({
    success: true,
    data: data,
    message: `All Transaction have been loaded`,
  });
};

exports.getPemesananByDate = async (request, response) => {
  const { date } = request.query;
  const filterDate = date !== undefined ? date : new Date().toISOString().split('T')[0];

  const result = await sequelize.query(
    `SELECT 
      pemesanans.id,
      pemesanans.nama_pemesanan,
      pemesanans.email_pemesanan,
      pemesanans.tgl_pemesanan,
      pemesanans.tgl_check_in,
      pemesanans.tgl_check_out,
      pemesanans.nama_tamu,
      pemesanans.jumlah_kamar,
      pemesanans.status_pemesanan,
      users.nama_user,
      tipe_kamars.nama_tipe_kamar,
      kamars.nomor_kamar,
      detail_pemesanans.harga 
    FROM 
      pemesanans 
    JOIN 
      tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar 
    LEFT JOIN 
      users ON users.id = pemesanans.id_user 
    JOIN 
      detail_pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id 
    JOIN 
      kamars ON kamars.id = detail_pemesanans.id_kamar 
    WHERE 
      DATE(pemesanans.tgl_pemesanan) = :filterDate
    GROUP BY 
      pemesanans.id 
    ORDER BY 
      pemesanans.id DESC;`,
    {
      replacements: { filterDate }
    }
  );

  if (result[0].length === 0) {
    return response.status(400).json({
      success: false,
      message: "No transactions to show for the selected date",
    });
  }

  const data = [];
  for (let index = 0; index < result[0].length; index++) {
    const getNomorKamar = await sequelize.query(
      `SELECT kamars.nomor_kamar FROM detail_pemesanans 
       JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id 
       JOIN kamars ON kamars.id = detail_pemesanans.id_kamar 
       WHERE pemesanans.id = :pemesananId 
       GROUP BY kamars.id 
       ORDER BY pemesanans.id DESC`,
      {
        replacements: { pemesananId: result[0][index].id }
      }
    );

    data.push({
      id: result[0][index].id,
      nama_pemesanan: result[0][index].nama_pemesanan,
      email_pemesanan: result[0][index].email_pemesanan,
      tgl_pemesanan: result[0][index].tgl_pemesanan,
      tgl_check_in: result[0][index].tgl_check_in,
      tgl_check_out: result[0][index].tgl_check_out,
      nama_tamu: result[0][index].nama_tamu,
      nomor_pemesanan: result[0][index].nomor_pemesanan,
      jumlah_kamar: result[0][index].jumlah_kamar,
      harga: result[0][index].harga,
      status_pemesanan: result[0][index].status_pemesanan,
      nama_user: result[0][index].nama_user,
      nama_tipe_kamar: result[0][index].nama_tipe_kamar,
      nomor_kamar: getNomorKamar[0],
    });
  }

  response.json({
    success: true,
    data: data,
    message: `Transactions for the selected date have been loaded`,
  });
};

//mendapatkan salah satu data
exports.find = async (request, response) => {
  let transID = request.body.id;
  let status = request.body.status;
  let date = request.body.date;
  let checkIn = request.body.check_in;
  let namaTamu = request.body.nama_tamu;

  console.log(transID);

  let result = [];
  if (
    transID !== "" &&
    status === undefined &&
    date === undefined &&
    checkIn === undefined &&
    namaTamu === undefined
  ) {
    let query = await sequelize.query(
      `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${transID} GROUP BY kamars.id ORDER BY kamars.id DESC`
    );
    if (query[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: "nothing transaction to show",
      });
    }
    result.push(query[0]);
    console.log(query);
  } else if (
    status !== "" &&
    transID === undefined &&
    date === undefined &&
    checkIn === undefined &&
    namaTamu === undefined
  ) {
    let query = await sequelize.query(
      `SELECT pemesanans.id, pemesanans.nama_pemesanan,pemesanans.nomor_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.status_pemesanan='${status}' GROUP BY pemesanans.id`
    );
    console.log(query);
    if (query[0].length === 0) {
      return response.json({
        success: false,
        message: "nothing transaction to show",
      });
    }
    result.push(query[0]);
  } else if (
    date !== "" &&
    status === undefined &&
    transID === undefined &&
    checkIn === undefined &&
    namaTamu === undefined
  ) {
    let query = await sequelize.query(
      `SELECT pemesanans.id, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.nomor_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.tgl_pemesanan='${date}' GROUP BY pemesanans.id`
    );
    if (query[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: "nothing transaction to show",
      });
    }
    result.push(query[0]);
  } else if (
    checkIn !== "" &&
    status === undefined &&
    transID === undefined &&
    date === undefined &&
    namaTamu === undefined
  ) {
    let query = await sequelize.query(
      `SELECT pemesanans.id, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.nomor_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.tgl_check_in='${checkIn}' GROUP BY pemesanans.id`
    );
    if (query[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: "nothing transaction to show",
      });
    }
    result.push(query[0]);
  } else if (
    namaTamu !== "" &&
    status === undefined &&
    transID === undefined &&
    date === undefined &&
    checkIn === undefined
  ) {
    let query = await sequelize.query(
      `SELECT pemesanans.id, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.nomor_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.nama_tamu like '%${namaTamu}%' GROUP BY pemesanans.id`
    );
    if (query[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: "nothing transaction to show",
      });
    }
    result.push(query[0]);
  }

  if (
    transID !== "" &&
    status === undefined &&
    date === undefined &&
    checkIn === undefined &&
    namaTamu === undefined
  ) {
    let data = [];

    for (let index = 0; index < result[0].length; index++) {
      const getNomorKamar = await sequelize.query(
        `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
      );
      // console.log("ll",getNomorKamar);
      data.push({
        id: result[0][index].id,
        nomor_pemesanan: result[0][index].nomor_pemesanan,
        nama_pemesanan: result[0][index].nama_pemesanan,
        email_pemesanan: result[0][index].email_pemesanan,
        tgl_pemesanan: result[0][index].tgl_pemesanan,
        tgl_check_in: result[0][index].tgl_check_in,
        tgl_check_out: result[0][index].tgl_check_out,
        nama_tamu: result[0][index].nama_tamu,
        jumlah_kamar: result[0][index].jumlah_kamar,
        harga: result[0][index].harga,
        status_pemesanan: result[0][index].status_pemesanan,
        nama_user: result[0][index].nama_user,
        nama_tipe_kamar: result[0][index].nama_tipe_kamar,
        nomor_kamar: getNomorKamar[0],
      });
      // nomorKamar.pop();
    }
    return response.json({
      success: true,
      data: data,
      message: `Transaction have been loaded`,
    });
  }

  const data = [];

  for (let index = 0; index < result[0]?.length; index++) {
    const getNomorKamar = await sequelize.query(
      `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
    );
    data.push({
      id: result[0][index].id,
      nomor_pemesanan: result[0][index].nomor_pemesanan,
      nama_pemesanan: result[0][index].nama_pemesanan,
      email_pemesanan: result[0][index].email_pemesanan,
      tgl_pemesanan: result[0][index].tgl_pemesanan,
      tgl_check_in: result[0][index].tgl_check_in,
      tgl_check_out: result[0][index].tgl_check_out,
      nama_tamu: result[0][index].nama_tamu,
      jumlah_kamar: result[0][index].jumlah_kamar,
      harga: result[0][index].harga,
      status_pemesanan: result[0][index].status_pemesanan,
      nama_user: result[0][index].nama_user,
      nama_tipe_kamar: result[0][index].nama_tipe_kamar,
      nomor_kamar: getNomorKamar[0],
    });
  }
  return response.json({
    success: true,
    data: data,
    message: `Transaction have been loaded`,
  });
};

exports.IncomeToday = async (request, response) => {
  const getData = await sequelize.query(
    "SELECT SUM(uang_masuk) AS total FROM ( SELECT HARGA AS uang_masuk FROM detail_pemesanans JOIN pemesanans ON pemesanans.id = detail_pemesanans.id_pemesanan WHERE pemesanans.tgl_pemesanan = DATE(now()) GROUP BY detail_pemesanans.id_pemesanan ) AS subquery"
  );

  if (getData[0][0].total === null || getData[0][0].total === "0") {
    return response.json({
      success: false,
      message: "nothing transaction this month",
      data: `0`,
    });
  }
  response.json({
    success: true,
    data: getData[0][0],
    message: `All Transaction have been loaded`,
  });
};

exports.IncomeThisMonth = async (request, response) => {
  const getData = await sequelize.query(
    "SELECT SUM(uang_masuk) AS total FROM (SELECT HARGA AS uang_masuk FROM detail_pemesanans JOIN pemesanans ON pemesanans.id = detail_pemesanans.id_pemesanan WHERE MONTH(pemesanans.tgl_pemesanan) = MONTH(NOW()) GROUP BY detail_pemesanans.id_pemesanan) AS subquery"
  );

  if (getData[0][0].total === null || getData[0][0].total === "0") {
    return response.json({
      success: false,
      message: "nothing transaction this month",
      data: `0`,
    });
  }
  response.json({
    success: true,
    data: getData[0][0],
    message: `All Transaction have been loaded`,
  });
};

exports.addPemesananNew = async (request, response) => {
  //cek nama_user
  let nama_user = request.body.nama_user;
  let userId = await userModel.findOne({
    where: {
      [Op.and]: [{ nama_user: nama_user }],
    },
  });
  if (userId === null) {
    return response.status(400).json({
      success: false,
      message: `User yang anda inputkan tidak ada`,
    });
  } else {
    //tanggal pemesanan sesuai tanggal hari ini + random string
    let date = moment();
    let tgl_pemesanan = date.format("YYYY-MM-DD");
    const random = randomstring.generate(7);
    let nomorPem = `${tgl_pemesanan}_${random}`;
    console.log(tgl_pemesanan);

    let check_in = request.body.check_in;
    let check_out = request.body.check_out;
    const date1 = moment(check_in);
    const date2 = moment(check_out);

    if (date2.isBefore(date1)) {
      return response.status(400).json({
        success: false,
        message: "masukkan tanggal yang benar",
      });
    }
    let tipe_kamar = request.body.tipe_kamar;

    let tipeRoomCheck = await tipeModel.findOne({
      where: {
        [Op.and]: [{ nama_tipe_kamar: tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });
    console.log(tipeRoomCheck);
    if (tipeRoomCheck === null) {
      return response.status(400).json({
        success: false,
        message: `Tidak ada tipe kamar dengan nama itu`,
      });
    }
    //mendapatkan kamar yang available di antara tanggal check in dan check out sesuai dengan tipe yang diinput user
    const result = await sequelize.query(
      `SELECT tipe_kamars.nama_tipe_kamar, kamars.nomor_kamar FROM kamars LEFT JOIN tipe_kamars ON kamars.id_tipe_kamar = tipe_kamars.id LEFT JOIN detail_pemesanans ON detail_pemesanans.id_kamar = kamars.id WHERE kamars.id NOT IN (SELECT id_kamar from detail_pemesanans WHERE tgl_akses BETWEEN '${check_in}' AND '${check_out}') AND tipe_kamars.nama_tipe_kamar ='${tipe_kamar}' GROUP BY kamars.nomor_kamar`
    );
    //cek apakah ada
    if (result[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: `Kamar dengan tipe itu dan di tanggal itu sudah terbooking`,
      });
    }

    //masukkan nomor kamar ke dalam array
    const array = [];
    for (let index = 0; index < result[0].length; index++) {
      array.push(result[0][index].nomor_kamar);
    }

    //validasi agar input jumlah kamar tidak lebih dari kamar yang tersedia
    if (result[0].length < request.body.jumlah_kamar) {
      return response.status(400).json({
        success: false,
        message: `hanya ada ${result[0].length} kamar tersedia`,
      });
    }

    //mencari random index dengan jumlah sesuai input jumlah kamar
    let randomIndex = [];
    for (let index = 0; index < request.body.jumlah_kamar; index++) {
      randomIndex.push(Math.floor(Math.random() * array.length));
    }

    //isi data random elemnt dengan isi dari array dengan index random dari random index
    let randomElement = [];
    for (let index = 0; index < randomIndex.length; index++) {
      randomElement.push(Number(array[index]));
    }

    console.log("random index", randomIndex);
    console.log("random", randomElement);

    //isi roomId dengan data kamar hasil randoman
    let roomId = [];
    for (let index = 0; index < randomElement.length; index++) {
      roomId.push(
        await roomModel.findOne({
          where: {
            [Op.and]: [{ nomor_kamar: randomElement[index] }],
          },
          attributes: [
            "id",
            "nomor_kamar",
            "id_tipe_kamar",
            "createdAt",
            "updatedAt",
          ],
        })
      );
    }

    console.log("roomid", roomId);

    //dapatkan harga dari id_tipe_kamar dikali dengan inputan jumlah kamar
    let roomPrice = 0;
    let cariTipe = await tipeModel.findOne({
      where: {
        [Op.and]: [{ id: roomId[0].id_tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });
    roomPrice = cariTipe.harga * request.body.jumlah_kamar;

    let newData = {
      nomor_pemesanan: nomorPem,
      nama_pemesanan: request.body.nama_pemesanan,
      email_pemesanan: request.body.email_pemesanan,
      tgl_pemesanan: tgl_pemesanan,
      tgl_check_in: check_in,
      tgl_check_out: check_out,
      nama_tamu: request.body.nama_tamu,
      jumlah_kamar: request.body.jumlah_kamar,
      id_tipe_kamar: cariTipe.id,
      status_pemesanan: request.body.status,
      id_user: userId.id,
    };

    //menetukan harga dengan cara mengali selisih tanggal check in dan check out dengan harga tipe kamar
    const startDate = moment(newData.tgl_check_in);
    const endDate = moment(newData.tgl_check_out);
    const duration = moment.duration(endDate.diff(startDate));
    const nights = duration.asDays();
    const harga = nights * roomPrice;

    //cek jika ada inputan kosong
    for (const [key, value] of Object.entries(newData)) {
      if (!value || value === "") {
        console.log(`Error: ${key} is empty`);
        return response
          .status(400)
          .json({ error: `${key} kosong mohon di isi` });
      }
    }

    pemesananModel
      .create(newData)
      .then((result) => {
        let pemesananID = result.id;

        let tgl1 = new Date(result.tgl_check_in);
        let tgl2 = new Date(result.tgl_check_out);
        let checkIn = moment(tgl1).format("YYYY-MM-DD");
        let checkOut = moment(tgl2).format("YYYY-MM-DD");

        // check if the dates are valid
        let success = true;
        let message = "";

        //looping detail pemesanan anatar tanggal check in sampai 1 hari sebelum check out agara mudah dalam cek available
        for (
          let m = moment(checkIn, "YYYY-MM-DD");
          m.isBefore(checkOut);
          m.add(1, "days")
        ) {
          let date = m.format("YYYY-MM-DD");

          // isi newDetail dengan id kamar hasil randomana lalu insert dengan di loop sesuai array yang berisi randoman kamar
          let newDetail = [];
          for (let index = 0; index < roomId.length; index++) {
            newDetail.push({
              id_pemesanan: pemesananID,
              id_kamar: roomId[index].id,
              tgl_akses: date,
              harga: harga,
            });
            detailsOfPemesananModel
              .create(newDetail[index])
              .then(async (resultss) => {
                let result = []
          let query = await sequelize.query(
            `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${pemesananID} GROUP BY kamars.id ORDER BY kamars.id DESC`
          );
          result.push(query[0]);
          let data = [];

          for (let index = 0; index < result[0].length; index++) {
            const getNomorKamar = await sequelize.query(
              `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
            );
            // console.log("ll",getNomorKamar);
            data.push({
              id: result[0][index].id,
              nama_pemesanan: result[0][index].nama_pemesanan,
              email_pemesanan: result[0][index].email_pemesanan,
              tgl_pemesanan: result[0][index].tgl_pemesanan,
              tgl_check_in: result[0][index].tgl_check_in,
              tgl_check_out: result[0][index].tgl_check_out,
              nama_tamu: result[0][index].nama_tamu,
              jumlah_kamar: result[0][index].jumlah_kamar,
              harga: result[0][index].harga,
              status_pemesanan: result[0][index].status_pemesanan,
              nama_user: result[0][index].nama_user,
              nama_tipe_kamar: result[0][index].nama_tipe_kamar,
              nomor_kamar: getNomorKamar[0],
            });
            // nomorKamar.pop();
          }
          return response.json({
            success: true,
            data: data,
            message: `Transaction have been insert`,
          });
              })
              .catch((error) => {
                success = false;
                message = error.message;
              });
          }
          console.log(m);
        }
      })
      .catch((error) => {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      });
  }
};

exports.addPemesananNewManual = async (request, response) => {
  //cek nama_user
  let nama_user = request.body.nama_user;
  let userId = await userModel.findOne({
    where: {
      [Op.and]: [{ nama_user: nama_user }],
    },
  });
  if (userId === null) {
    return response.status(400).json({
      success: false,
      message: `User yang anda inputkan tidak ada`,
    });
  } else {
    //tanggal pemesanan sesuai tanggal hari ini + random string
    let date = moment();
    let tgl_pemesanan = date.format("YYYY-MM-DD");
    const random = randomstring.generate(7);
    let nomorPem = `${tgl_pemesanan}_${random}`;
    console.log(tgl_pemesanan);

    let check_in = request.body.check_in;
    let check_out = request.body.check_out;
    const date1 = moment(check_in);
    const date2 = moment(check_out);

    if (date2.isBefore(date1)) {
      return response.status(400).json({
        success: false,
        message: "masukkan tanggal yang benar",
      });
    }
    let tipe_kamar = request.body.tipe_kamar;

    let tipeRoomCheck = await tipeModel.findOne({
      where: {
        [Op.and]: [{ nama_tipe_kamar: tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });
    console.log(tipeRoomCheck);
    if (tipeRoomCheck === null) {
      return response.status(400).json({
        success: false,
        message: `Tidak ada tipe kamar dengan nama itu`,
      });
    }

    for (let index = 0; index < request.body.nomor_kamar.length; index++) {
      const cariKamar = await roomModel.findOne({
        where: {
          [Op.and]: [
            { nomor_kamar: request.body.nomor_kamar[index] },
            { id_tipe_kamar: tipeRoomCheck.id },
          ],
        },
        attributes: [
          "id",
          "nomor_kamar",
          "id_tipe_kamar",
          "createdAt",
          "updatedAt",
        ],
      });
      if (cariKamar === null) {
        return response.status(400).json({
          success: false,
          message: `Nomor kamar ${request.body.nomor_kamar[index]} tidak ada di tipe kamar ${request.body.tipe_kamar}`,
        });
      }
    }

    //mendapatkan kamar yang available di antara tanggal check in dan check out sesuai dengan tipe yang diinput user
    const result = await sequelize.query(
      `SELECT tipe_kamars.nama_tipe_kamar, kamars.nomor_kamar FROM kamars LEFT JOIN tipe_kamars ON kamars.id_tipe_kamar = tipe_kamars.id LEFT JOIN detail_pemesanans ON detail_pemesanans.id_kamar = kamars.id WHERE kamars.id NOT IN (SELECT id_kamar from detail_pemesanans WHERE tgl_akses BETWEEN '${check_in}' AND '${check_out}') AND tipe_kamars.nama_tipe_kamar ='${tipe_kamar}' GROUP BY kamars.nomor_kamar`
    );
    //cek apakah ada
    if (result[0].length === 0) {
      return response.status(400).json({
        success: false,
        message: `Kamar dengan tipe itu dan di tanggal itu sudah terbooking semua`,
      });
    }

    //masukkan nomor kamar ke dalam array
    const array = [];
    for (let index = 0; index < request.body.nomor_kamar.length; index++) {
      array.push(request.body.nomor_kamar);
    }

    console.log("array", array);

    //isi roomId dengan data kamar hasil randoman
    let roomId = [];
    for (let index = 0; index < array.length; index++) {
      roomId.push(
        await roomModel.findOne({
          where: {
            [Op.and]: [{ nomor_kamar: array[0][index] }],
          },
          attributes: [
            "id",
            "nomor_kamar",
            "id_tipe_kamar",
            "createdAt",
            "updatedAt",
          ],
        })
      );
    }

    console.log("roomid", roomId[0].id_tipe_kamar);

    //dapatkan harga dari id_tipe_kamar dikali dengan inputan jumlah kamar
    let roomPrice = 0;
    let cariTipe = await tipeModel.findOne({
      where: {
        [Op.and]: [{ id: roomId[0].id_tipe_kamar }],
      },
      attributes: [
        "id",
        "nama_tipe_kamar",
        "harga",
        "deskripsi",
        "foto",
        "createdAt",
        "updatedAt",
      ],
    });
    // roomPrice = cariTipe.harga * request.body.jumlah_kamar;

    let newData = {
      nomor_pemesanan: nomorPem,
      nama_pemesanan: request.body.nama_pemesanan,
      email_pemesanan: request.body.email_pemesanan,
      tgl_pemesanan: tgl_pemesanan,
      tgl_check_in: check_in,
      tgl_check_out: check_out,
      nama_tamu: request.body.nama_tamu,
      jumlah_kamar: request.body.nomor_kamar.length,
      id_tipe_kamar: cariTipe.id,
      status_pemesanan: request.body.status,
      id_user: userId.id,
    };

    //menetukan harga dengan cara mengali selisih tanggal check in dan check out dengan harga tipe kamar
    const startDate = moment(newData.tgl_check_in);
    const endDate = moment(newData.tgl_check_out);
    const duration = moment.duration(endDate.diff(startDate));
    const nights = duration.asDays();
    const harga = nights * cariTipe.harga * request.body.nomor_kamar.length;

    //cek jika ada inputan kosong
    for (const [key, value] of Object.entries(newData)) {
      if (!value || value === "") {
        console.log(`Error: ${key} is empty`);
        return response
          .status(400)
          .json({ error: `${key} kosong mohon di isi` });
      }
    }

    pemesananModel
      .create(newData)
      .then((result) => {
        let pemesananID = result.id;

        let tgl1 = new Date(result.tgl_check_in);
        let tgl2 = new Date(result.tgl_check_out);
        let checkIn = moment(tgl1).format("YYYY-MM-DD");
        let checkOut = moment(tgl2).format("YYYY-MM-DD");

        // check if the dates are valid
        let success = true;
        let message = "";

        //looping detail pemesanan anatar tanggal check in sampai 1 hari sebelum check out agara mudah dalam cek available
        for (
          let m = moment(checkIn, "YYYY-MM-DD");
          m.isBefore(checkOut);
          m.add(1, "days")
        ) {
          let date = m.format("YYYY-MM-DD");

          // isi newDetail dengan id kamar hasil randomana lalu insert dengan di loop sesuai array yang berisi randoman kamar
          let newDetail = [];
          for (let index = 0; index < roomId.length; index++) {
            newDetail.push({
              id_pemesanan: pemesananID,
              id_kamar: roomId[index].id,
              tgl_akses: date,
              harga: harga,
            });
            detailsOfPemesananModel
              .create(newDetail[index])
              .then(async (resultss) => {
                let result = []
          let query = await sequelize.query(
            `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${pemesananID} GROUP BY kamars.id ORDER BY kamars.id DESC`
          );
          result.push(query[0]);
          let data = [];

          for (let index = 0; index < result[0].length; index++) {
            const getNomorKamar = await sequelize.query(
              `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
            );
            // console.log("ll",getNomorKamar);
            data.push({
              id: result[0][index].id,
              nama_pemesanan: result[0][index].nama_pemesanan,
              email_pemesanan: result[0][index].email_pemesanan,
              tgl_pemesanan: result[0][index].tgl_pemesanan,
              tgl_check_in: result[0][index].tgl_check_in,
              tgl_check_out: result[0][index].tgl_check_out,
              nama_tamu: result[0][index].nama_tamu,
              jumlah_kamar: result[0][index].jumlah_kamar,
              harga: result[0][index].harga,
              status_pemesanan: result[0][index].status_pemesanan,
              nama_user: result[0][index].nama_user,
              nama_tipe_kamar: result[0][index].nama_tipe_kamar,
              nomor_kamar: getNomorKamar[0],
            });
            // nomorKamar.pop();
          }
          return response.json({
            success: true,
            nomor_pemesanan: newData.nomor_pemesanan,
            message: `Transaction have been insert`,
          });
              })
              .catch((error) => {
                success = false;
                message = error.message;
              });
          }
          console.log(m);
        }
      })
      .catch((error) => {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      });
  }
};

exports.verify = async (request, response) => {
  let nama_user = request.body.nama_user;
  let idPemesanan = request.body.idPemesanan;

  let userId = await userModel.findOne({
    where: {
      [Op.and]: [{ nama_user: nama_user }],
    },
  });
  if (userId === null) {
    return response.status(400).json({
      success: false,
      message: `User yang anda inputkan tidak ada`,
    });
  }
  let newData = {
    id_user: userId.id,
  };
  try {
    await pemesananModel.update(newData, { where: { id: idPemesanan } });
    let result = []
    let query = await sequelize.query(
      `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${idPemesanan} GROUP BY kamars.id ORDER BY kamars.id DESC`
    );
    result.push(query[0]);
    let data = [];
    for (let index = 0; index < result[0].length; index++) {
      const getNomorKamar = await sequelize.query(
        `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
      );
      // console.log("ll",getNomorKamar);
      data.push({
        id: result[0][index].id,
        nama_pemesanan: result[0][index].nama_pemesanan,
        email_pemesanan: result[0][index].email_pemesanan,
        tgl_pemesanan: result[0][index].tgl_pemesanan,
        tgl_check_in: result[0][index].tgl_check_in,
        tgl_check_out: result[0][index].tgl_check_out,
        nama_tamu: result[0][index].nama_tamu,
        jumlah_kamar: result[0][index].jumlah_kamar,
        harga: result[0][index].harga,
        status_pemesanan: result[0][index].status_pemesanan,
        nama_user: result[0][index].nama_user,
        nama_tipe_kamar: result[0][index].nama_tipe_kamar,
        nomor_kamar: getNomorKamar[0],
      });
      // nomorKamar.pop();
    }
    return response.json({
      success: true,
      data: data,
      message: `Transaction have been loaded`,
    });
  } catch (error) {
    console.log(error);
    return response.status(400).json({
      success: false,
      message: error,
    });
  }
};

exports.changeStatus = async (request, response) => {
  let status = request.body.status;
  let idPemesanan = request.body.idPemesanan;
console.log(status);
  
  if (status !== "baru" && status !== "checkin" && status !== "checkout") {
    return response.status(400).json({
      success: false,
      message: `Status hanya boleh diisi dengan baru / checkin / checkout`,
    });
  }
  
  let newData = {
    status_pemesanan:status
  };
  try {
    await pemesananModel.update(newData, { where: { id: idPemesanan } });
    let result = []
    let query = await sequelize.query(
      `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${idPemesanan} GROUP BY kamars.id ORDER BY kamars.id DESC`
    );
    result.push(query[0]);
    let data = [];
    for (let index = 0; index < result[0].length; index++) {
      const getNomorKamar = await sequelize.query(
        `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
      );
      // console.log("ll",getNomorKamar);
      data.push({
        id: result[0][index].id,
        nama_pemesanan: result[0][index].nama_pemesanan,
        email_pemesanan: result[0][index].email_pemesanan,
        tgl_pemesanan: result[0][index].tgl_pemesanan,
        tgl_check_in: result[0][index].tgl_check_in,
        tgl_check_out: result[0][index].tgl_check_out,
        nama_tamu: result[0][index].nama_tamu,
        jumlah_kamar: result[0][index].jumlah_kamar,
        harga: result[0][index].harga,
        status_pemesanan: result[0][index].status_pemesanan,
        nama_user: result[0][index].nama_user,
        nama_tipe_kamar: result[0][index].nama_tipe_kamar,
        nomor_kamar: getNomorKamar[0],
      });
      // nomorKamar.pop();
    }
    return response.json({
      success: true,
      data: data,
      message: `Transaction have been loaded`,
    });
  } catch (error) {
    console.log(error);
    return response.status(400).json({
      success: false,
      message: error,
    });
  }
};

exports.Reservation = async (request, response) => {
   //cek nama_user
   let nama_pemesanan = request.body.nama_pemesanan;
   let nama_tamu = request.body.nama_tamu;
   let email_pemesanan = request.body.email_pemesanan;
   let jumlah_kamar = request.body.jumlah_kamar;
   let userId = await userModel.findOne({
     where: {
       [Op.and]: [{ nama_user: nama_pemesanan }],
     },
   });
   
     //tanggal pemesanan sesuai tanggal hari ini + random string
     let date = moment();
     let tgl_pemesanan = date.format("YYYY-MM-DD");
     const random = randomstring.generate(7);
     let nomorPem = `${tgl_pemesanan}_${random}`;
     console.log(tgl_pemesanan);
 
     let check_in = request.body.check_in;
     let check_out = request.body.check_out;
     const date1 = moment(check_in);
     const date2 = moment(check_out);
 
     if (date2.isBefore(date1)) {
       return response.json({
         success: false,
         message: "masukkan tanggal yang benar",
       });
     }
     let tipe_kamar = request.body.tipe_kamar;
 
     let tipeRoomCheck = await tipeModel.findOne({
       where: {
         [Op.and]: [{ nama_tipe_kamar: tipe_kamar }],
       },
       attributes: [
         "id",
         "nama_tipe_kamar",
         "harga",
         "deskripsi",
         "foto",
         "createdAt",
         "updatedAt",
       ],
     });
     console.log(tipeRoomCheck);
     if (tipeRoomCheck === null) {
       return response.json({
         success: false,
         message: `Tidak ada tipe kamar dengan nama itu`,
       });
     }
     //mendapatkan kamar yang available di antara tanggal check in dan check out sesuai dengan tipe yang diinput user
     const result = await sequelize.query(
       `SELECT tipe.nama_tipe_kamar, kamar.nomor_kamar
      FROM kamars  as kamar JOIN tipe_kamars as tipe ON kamar.id_tipe_kamar = tipe.id
      WHERE tipe.nama_tipe_kamar='${tipe_kamar}' AND kamar.id NOT IN ( SELECT id_kamar FROM detail_pemesanans as dp join pemesanans as p ON p.id = dp.id_pemesanan WHERE p.status_pemesanan != 'checkout' AND dp.tgl_akses BETWEEN "${check_in}" AND "${check_out}" ) GROUP BY kamar.id ORDER BY kamar.id DESC`
     );
     //cek apakah ada
     if (result[0].length === 0) {
       return response.json({
         success: false,
         message: `Kamar dengan tipe itu dan di tanggal itu sudah terbooking`,
       });
     }
 
     //masukkan nomor kamar ke dalam array
     const array = [];
     for (let index = 0; index < result[0].length; index++) {
       array.push(result[0][index].nomor_kamar);
     }
 
     //validasi agar input jumlah kamar tidak lebih dari kamar yang tersedia
     if (result[0].length < request.body.jumlah_kamar) {
       return response.json({
         success: false,
         message: `hanya ada ${result[0].length} kamar tersedia`,
       });
     }
 
     //mencari random index dengan jumlah sesuai input jumlah kamar
     let randomIndex = [];
     for (let index = 0; index < request.body.jumlah_kamar; index++) {
       randomIndex.push(Math.floor(Math.random() * array.length));
     }
 
     //isi data random elemnt dengan isi dari array dengan index random dari random index
     let randomElement = [];
     for (let index = 0; index < randomIndex.length; index++) {
       randomElement.push(Number(array[index]));
     }
 
     console.log("random index", randomIndex);
     console.log("random", randomElement);
 
     //isi roomId dengan data kamar hasil randoman
     let roomId = [];
     for (let index = 0; index < randomElement.length; index++) {
       roomId.push(
         await roomModel.findOne({
           where: {
             [Op.and]: [{ nomor_kamar: randomElement[index] }],
           },
           attributes: [
             "id",
             "nomor_kamar",
             "id_tipe_kamar",
             "createdAt",
             "updatedAt",
           ],
         })
       );
     }
 
     console.log("roomid", roomId);
 
     //dapatkan harga dari id_tipe_kamar dikali dengan inputan jumlah kamar
     let roomPrice = 0;
     let cariTipe = await tipeModel.findOne({
       where: {
         [Op.and]: [{ id: roomId[0].id_tipe_kamar }],
       },
       attributes: [
         "id",
         "nama_tipe_kamar",
         "harga",
         "deskripsi",
         "foto",
         "createdAt",
         "updatedAt",
       ],
     });
     roomPrice = cariTipe.harga * request.body.jumlah_kamar;
 
     let newData = {
       nomor_pemesanan: nomorPem,
       nama_pemesanan: nama_pemesanan,
       email_pemesanan: email_pemesanan,
       tgl_pemesanan: tgl_pemesanan,
       tgl_check_in: check_in,
       tgl_check_out: check_out,
       nama_tamu: nama_tamu,
       jumlah_kamar: jumlah_kamar,
       id_tipe_kamar: cariTipe.id,
       status_pemesanan: "baru",
       id_user: "0",
     };
 
     //menetukan harga dengan cara mengali selisih tanggal check in dan check out dengan harga tipe kamar
     const startDate = moment(newData.tgl_check_in);
     const endDate = moment(newData.tgl_check_out);
     const duration = moment.duration(endDate.diff(startDate));
     const nights = duration.asDays();
     const harga = nights * roomPrice;
 
     //cek jika ada inputan kosong
     for (const [key, value] of Object.entries(newData)) {
       if (!value || value === "") {
         console.log(`Error: ${key} is empty`);
       return response.json({
        success: false,
        message:`${key} kosong mohon di isi`,
      });
     }
    } 
     pemesananModel
       .create(newData)
       .then((result) => {
         let pemesananID = result.id;
 
         let tgl1 = new Date(result.tgl_check_in);
         let tgl2 = new Date(result.tgl_check_out);
         let checkIn = moment(tgl1).format("YYYY-MM-DD");
         let checkOut = moment(tgl2).format("YYYY-MM-DD");
 
         // check if the dates are valid
         let success = true;
         let message = "";
 
         //looping detail pemesanan anatar tanggal check in sampai 1 hari sebelum check out agara mudah dalam cek available
         for (
           let m = moment(checkIn, "YYYY-MM-DD");
           m.isBefore(checkOut);
           m.add(1, "days")
         ) {
           let date = m.format("YYYY-MM-DD");
 
           // isi newDetail dengan id kamar hasil randomana lalu insert dengan di loop sesuai array yang berisi randoman kamar
           let newDetail = [];
           for (let index = 0; index < roomId.length; index++) {
             newDetail.push({
               id_pemesanan: pemesananID,
               id_kamar: roomId[index].id,
               tgl_akses: date,
               harga: harga,
             });
             detailsOfPemesananModel
               .create(newDetail[index])
               .then(async (resultss) => {
                let result = []
                let query = await sequelize.query(
                  `SELECT  pemesanans.id, pemesanans.nomor_pemesanan, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,detail_pemesanans.harga,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.id=${pemesananID} GROUP BY kamars.id ORDER BY kamars.id DESC`
                );
                result.push(query[0]);
                let data = [];
      
                for (let index = 0; index < result[0].length; index++) {
                  const getNomorKamar = await sequelize.query(
                    `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
                  );
                  // console.log("ll",getNomorKamar);
                  data.push({
                    id: result[0][index].id,
                    nama_pemesanan: result[0][index].nama_pemesanan,
                    email_pemesanan: result[0][index].email_pemesanan,
                    tgl_pemesanan: result[0][index].tgl_pemesanan,
                    tgl_check_in: result[0][index].tgl_check_in,
                    tgl_check_out: result[0][index].tgl_check_out,
                    nama_tamu: result[0][index].nama_tamu,
                    jumlah_kamar: result[0][index].jumlah_kamar,
                    harga: result[0][index].harga,
                    status_pemesanan: result[0][index].status_pemesanan,
                    nama_user: result[0][index].nama_user,
                    nama_tipe_kamar: result[0][index].nama_tipe_kamar,
                    nomor_kamar: getNomorKamar[0],
                  });
                  // nomorKamar.pop();
                }
                return response.json({
                  success: true,
                  data: data,
                  message: `Transaction have been insert`,
                });
               })
               .catch((error) => {
                 success = false;
                 message = error.message;
               });
           }
           console.log(m);
         }
       })
       .catch((error) => {
         return response.status(400).json({
           success: false,
           message: error.message,
         });
       });
}

exports.getPemesananbyEmail = async (request,response) => {
  const email = request.body.email;

  // let result = [];
  let result = await sequelize.query(`SELECT pemesanans.id, pemesanans.nama_pemesanan,pemesanans.email_pemesanan,pemesanans.nomor_pemesanan,pemesanans.tgl_pemesanan,pemesanans.tgl_check_in,pemesanans.tgl_check_out,pemesanans.nama_tamu,pemesanans.jumlah_kamar,pemesanans.status_pemesanan, users.nama_user, tipe_kamars.nama_tipe_kamar,tipe_kamars.harga as harga_tipe_kamar, kamars.nomor_kamar FROM pemesanans JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar LEFT JOIN users ON users.id=pemesanans.id_user JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan=pemesanans.id JOIN kamars ON kamars.id=detail_pemesanans.id_kamar WHERE pemesanans.email_pemesanan = '${email}'  GROUP BY pemesanans.id ORDER BY pemesanans.id DESC`);
  if (result[0].length === 0) {
    return response.json({
      success: false,
      message: "nothing transaction to show",
    });
  }
  let data = [];

    for (let index = 0; index < result[0].length; index++) {
      const getNomorKamar = await sequelize.query(
        `SELECT kamars.nomor_kamar FROM detail_pemesanans JOIN pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id JOIN kamars ON kamars.id = detail_pemesanans.id_kamar WHERE pemesanans.id=${result[0][index].id} GROUP BY kamars.id ORDER BY pemesanans.id DESC`
      );
      // console.log("ll",getNomorKamar);
      data.push({
        id: result[0][index].id,
        nama_pemesanan: result[0][index].nama_pemesanan,
        email_pemesanan: result[0][index].email_pemesanan,
        tgl_pemesanan: result[0][index].tgl_pemesanan,
        tgl_check_in: result[0][index].tgl_check_in,
        tgl_check_out: result[0][index].tgl_check_out,
        nama_tamu: result[0][index].nama_tamu,
        jumlah_kamar: result[0][index].jumlah_kamar,
        harga: result[0][index].harga,
        status_pemesanan: result[0][index].status_pemesanan,
        nama_user: result[0][index].nama_user,
        nama_tipe_kamar: result[0][index].nama_tipe_kamar,
        nomor_kamar: getNomorKamar[0],
      });
      // nomorKamar.pop();
    }
    return response.json({
      success: true,
      data: data,
      message: `Transaction have been loaded`,
    });
}

const pdf = require('pdfkit');
const fs = require('fs');
const { CLIENT_RENEG_LIMIT } = require("tls");

exports.PrintPemesanan = async (request, response) => {
  try {
    const email = request.body.email;
    const id = request.body.id;

    // Query data pemesanan
    let result = await sequelize.query(`
      SELECT pemesanans.id, pemesanans.nama_pemesanan, pemesanans.email_pemesanan, pemesanans.nomor_pemesanan, pemesanans.tgl_pemesanan,
        pemesanans.tgl_check_in, pemesanans.tgl_check_out, pemesanans.nama_tamu, pemesanans.jumlah_kamar, pemesanans.status_pemesanan,
        users.nama_user, tipe_kamars.nama_tipe_kamar, tipe_kamars.harga AS harga_tipe_kamar, kamars.nomor_kamar
      FROM pemesanans
      JOIN tipe_kamars ON tipe_kamars.id = pemesanans.id_tipe_kamar
      LEFT JOIN users ON users.id = pemesanans.id_user
      JOIN detail_pemesanans ON detail_pemesanans.id_pemesanan = pemesanans.id
      JOIN kamars ON kamars.id = detail_pemesanans.id_kamar
      WHERE pemesanans.email_pemesanan = '${email}'
      AND pemesanans.id = '${id}'
      GROUP BY pemesanans.id
    `);

    // Cek jika tidak ada data pemesanan
    if (result[0].length === 0) {
      return response.json({
        success: false,
        message: "No transaction to show",
      });
    }

    // Buat dokumen PDF
    const doc = new pdf();
    const filePath = `./receipts/receipt_${id}.pdf`;

    doc.pipe(fs.createWriteStream(filePath));

    // Isi dokumen PDF
    doc.fontSize(18).text('Receipt Pemesanan', { align: 'center' });
    doc.moveDown();

    result[0].forEach((data) => {
      doc.fontSize(12).text(`ID Pemesanan: ${data.id}`);
      doc.text(`Nama Pemesan: ${data.nama_pemesanan}`);
      doc.text(`Email Pemesan: ${data.email_pemesanan}`);
      doc.text(`Tanggal Pemesanan: ${data.tgl_pemesanan}`);
      doc.text(`Check-in: ${data.tgl_check_in}`);
      doc.text(`Check-out: ${data.tgl_check_out}`);
      doc.text(`Nama Tamu: ${data.nama_tamu}`);
      doc.text(`Jumlah Kamar: ${data.jumlah_kamar}`);
      doc.text(`Harga per Kamar: ${data.harga_tipe_kamar}`);
      doc.text(`Status Pemesanan: ${data.status_pemesanan}`);
      doc.text(`Tipe Kamar: ${data.nama_tipe_kamar}`);
      doc.text(`Nomor Kamar: ${data.nomor_kamar}`);
      doc.moveDown();
    });

    // Akhiri dokumen PDF
    doc.end();

    // Kirim PDF sebagai respons
    doc.on('finish', () => {
      response.download(filePath, `receipt_${id}.pdf`, (err) => {
        if (err) {
          return response.status(500).json({
            success: false,
            message: "Failed to download receipt",
          });
        }
        fs.unlinkSync(filePath); // Hapus file setelah didownload
      });
    });

    response.status(200).json({
      success: true,
      message: "Receipt generated successfully",
    })
  } catch (error) {
    console.error("Error generating receipt:", error);
    response.status(500).json({
      success: false,
      message: "An error occurred while generating the receipt",
    });
  }
};
