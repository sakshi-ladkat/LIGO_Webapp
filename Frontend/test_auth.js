const formData = new FormData();
formData.append('key', 'value');

const mergedOptions = {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': 'Bearer test' }
};

console.log(mergedOptions.headers);
