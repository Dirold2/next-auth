import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div className="container">
        <div className="card">
            <div className="card-header">
                <h2>Not Found</h2>
            </div>
            <div className="card-footer">
                <br />
                <pre>Could not find requested resource</pre>
                <br />
                <Link href="/">Return Home</Link>
            </div>
        </div>
    </div>
  )
}