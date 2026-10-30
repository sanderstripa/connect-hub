import { Link } from 'react-router';

export default function AppHeader() {
  return (
    <header className="app-header">
      <Link className="app-brand" to="/">
        Connect. Hub
      </Link>
    </header>
  );
}
