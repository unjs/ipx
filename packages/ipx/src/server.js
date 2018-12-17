import connect from 'connect'
import IPXMiddleware from './middleware'

const app = connect()

app.listen(3000, () => {
  console.log('Listening on port 3000')
})

app.use('/foo', IPXMiddleware)
