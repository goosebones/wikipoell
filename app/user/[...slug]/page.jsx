export default async function UserPage({ params }) {
  const { slug } = await params;

  console.log(slug);
  return <div>dedicated User Page</div>;
}
