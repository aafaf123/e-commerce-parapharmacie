import { Component } from 'react'
import ServerError from '../pages/ServerError'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <ServerError onRetry={() => this.setState({ hasError: false })} />
    }
    return this.props.children
  }
}
