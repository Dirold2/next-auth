// This is an example of how to access a session from an API route
import { auth } from "auth"
import { NextApiRequest, NextApiResponse } from "next"

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await auth(req, res)
  res.json(session)
}
