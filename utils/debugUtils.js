exports.pretty = v => console.log(JSON.stringify(v, null, 4));
exports.j = str => JSON.stringify(str, null, 4);
exports.d = (val, label='') => {
    return;
    let msg = label + ': ';

    if (val === undefined) return console.log(msg + 'is undefined');
    if (val === null) return console.log(`${msg}${typeof val} is null`);
    if (typeof val === 'string') return console.log(`${msg}string\n${val}`);
    return console.log(`${msg}${typeof val}:\n${JSON.stringify(val, null, 4)}`);
}