"use client"
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const searchParams = useSearchParams();
 const errorMessage = searchParams?.get(`error`);

 return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2>Not Found</h2>
        </div>
        <div className="card-footer">
          <br />
          {errorMessage && <pre>{errorMessage}</pre>}
          <br />
          <Link href="/">Return Home</Link>
        </div>
      </div>
    </div>
 );
}