const router = require('express').Router();
const db = require('../database/database-interface');

// parent route: /authentication

router.route('/hello-world')
    .get((req, res) => {
        res.status(200).send('hello world');
    })

router.route('/trees')
    .get(db.getTrees)
    .post(db.createTree)

module.exports = router;