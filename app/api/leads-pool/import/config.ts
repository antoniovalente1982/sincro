// Aumenta il limite body per la route di import leads (file XLSX/CSV grandi)
export const config = {
    api: {
        bodyParser: false,          // gestiamo noi il parsing via formData()
        responseLimit: false,
        sizeLimit: '50mb',
    },
}
