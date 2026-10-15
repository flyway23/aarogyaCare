/** @param {import('express').Response} res @param {unknown} data @returns {void} */
export const respond = (res, data) => res.json({ success: true, data });
