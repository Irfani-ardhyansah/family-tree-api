import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth.middleware';
import { requireModuleUnlock } from '../../shared/middleware/requireModuleUnlock.middleware';
import { accountsController } from './accounts/accounts.controller';
import { activityController } from './activity/activity.controller';
import { auditLogsController } from './audit-logs/audit-logs.controller';
import { balancingController } from './balancing/balancing.controller';
import { budgetsController } from './budgets/budgets.controller';
import { cashWithdrawalsController } from './cash-withdrawals/cash-withdrawals.controller';
import { categoriesController } from './categories/categories.controller';
import { moneyDashboardController } from './dashboard/dashboard.controller';
import { debtsController } from './debts/debts.controller';
import { pocketsController } from './pockets/pockets.controller';
import { remindersController } from './reminders/reminders.controller';
import { monthlyReportsController } from './reports/monthly-reports.controller';
import { setupController } from './setup/setup.controller';
import { transactionsController } from './transactions/transactions.controller';
import { transfersController } from './transfers/transfers.controller';
import { wishlistController } from './wishlist/wishlist.controller';

const moneyRoutes = Router();

moneyRoutes.use(requireAuth);
moneyRoutes.use(requireModuleUnlock('money'));

// Setup & couple
moneyRoutes.get('/setup', (req, res, next) => {
  void setupController.getStatus(req, res, next);
});
moneyRoutes.post('/setup/persons', (req, res, next) => {
  void setupController.bootstrapPersons(req, res, next);
});
moneyRoutes.post('/couple-link', (req, res, next) => {
  void setupController.coupleLink(req, res, next);
});
moneyRoutes.delete('/couple-link', (req, res, next) => {
  void setupController.coupleUnlink(req, res, next);
});
moneyRoutes.post('/workspace/reset', (req, res, next) => {
  void setupController.resetWorkspace(req, res, next);
});

// Dashboard
moneyRoutes.get('/dashboard', (req, res, next) => {
  void moneyDashboardController.get(req, res, next);
});

// Monthly evaluation report
moneyRoutes.get('/reports/monthly', (req, res, next) => {
  void monthlyReportsController.monthly(req, res, next);
});

// Unified activity feed (txn + transfer + cash)
moneyRoutes.get('/activity', (req, res, next) => {
  void activityController.list(req, res, next);
});

// Accounts
moneyRoutes.get('/accounts', (req, res, next) => {
  void accountsController.list(req, res, next);
});
moneyRoutes.post('/accounts', (req, res, next) => {
  void accountsController.create(req, res, next);
});
moneyRoutes.patch('/accounts/:id', (req, res, next) => {
  void accountsController.update(req, res, next);
});
moneyRoutes.delete('/accounts/:id', (req, res, next) => {
  void accountsController.remove(req, res, next);
});

// Pockets
moneyRoutes.get('/pockets', (req, res, next) => {
  void pocketsController.list(req, res, next);
});
moneyRoutes.post('/pockets', (req, res, next) => {
  void pocketsController.create(req, res, next);
});
moneyRoutes.patch('/pockets/:id', (req, res, next) => {
  void pocketsController.update(req, res, next);
});
moneyRoutes.delete('/pockets/:id', (req, res, next) => {
  void pocketsController.remove(req, res, next);
});
moneyRoutes.post('/pockets/:id/archive', (req, res, next) => {
  void pocketsController.archive(req, res, next);
});
moneyRoutes.post('/pockets/:id/unarchive', (req, res, next) => {
  void pocketsController.unarchive(req, res, next);
});

// Categories
moneyRoutes.get('/categories', (req, res, next) => {
  void categoriesController.list(req, res, next);
});
moneyRoutes.post('/categories', (req, res, next) => {
  void categoriesController.create(req, res, next);
});
moneyRoutes.patch('/categories/:id', (req, res, next) => {
  void categoriesController.update(req, res, next);
});
moneyRoutes.delete('/categories/:id', (req, res, next) => {
  void categoriesController.remove(req, res, next);
});

// Transactions
moneyRoutes.get('/transactions', (req, res, next) => {
  void transactionsController.list(req, res, next);
});
moneyRoutes.get('/transactions/:id', (req, res, next) => {
  void transactionsController.getById(req, res, next);
});
moneyRoutes.post('/transactions', (req, res, next) => {
  void transactionsController.create(req, res, next);
});
moneyRoutes.patch('/transactions/:id', (req, res, next) => {
  void transactionsController.update(req, res, next);
});
moneyRoutes.delete('/transactions/:id', (req, res, next) => {
  void transactionsController.remove(req, res, next);
});

// Transfers
moneyRoutes.post('/transfers', (req, res, next) => {
  void transfersController.create(req, res, next);
});
moneyRoutes.get('/transfers/:id', (req, res, next) => {
  void transfersController.getById(req, res, next);
});
moneyRoutes.patch('/transfers/:id', (req, res, next) => {
  void transfersController.update(req, res, next);
});
moneyRoutes.delete('/transfers/:id', (req, res, next) => {
  void transfersController.remove(req, res, next);
});

// Cash withdrawals
moneyRoutes.post('/cash-withdrawals', (req, res, next) => {
  void cashWithdrawalsController.create(req, res, next);
});
moneyRoutes.get('/cash-withdrawals', (req, res, next) => {
  void cashWithdrawalsController.list(req, res, next);
});
moneyRoutes.get('/cash-withdrawals/:id', (req, res, next) => {
  void cashWithdrawalsController.getById(req, res, next);
});
moneyRoutes.patch('/cash-withdrawals/:id', (req, res, next) => {
  void cashWithdrawalsController.update(req, res, next);
});
moneyRoutes.delete('/cash-withdrawals/:id', (req, res, next) => {
  void cashWithdrawalsController.remove(req, res, next);
});

// Opening & balancing
moneyRoutes.post('/opening-balances', (req, res, next) => {
  void balancingController.openingBalances(req, res, next);
});
moneyRoutes.get('/balancing', (req, res, next) => {
  void balancingController.list(req, res, next);
});
moneyRoutes.post('/balancing/check', (req, res, next) => {
  void balancingController.check(req, res, next);
});
moneyRoutes.post('/balancing/adjust', (req, res, next) => {
  void balancingController.adjust(req, res, next);
});

// Wishlist
moneyRoutes.get('/wishlist', (req, res, next) => {
  void wishlistController.list(req, res, next);
});
moneyRoutes.post('/wishlist', (req, res, next) => {
  void wishlistController.create(req, res, next);
});
moneyRoutes.patch('/wishlist/:id', (req, res, next) => {
  void wishlistController.update(req, res, next);
});
moneyRoutes.delete('/wishlist/:id', (req, res, next) => {
  void wishlistController.remove(req, res, next);
});

// Debts
moneyRoutes.get('/debts', (req, res, next) => {
  void debtsController.list(req, res, next);
});
moneyRoutes.post('/debts', (req, res, next) => {
  void debtsController.create(req, res, next);
});
moneyRoutes.get('/debts/:id', (req, res, next) => {
  void debtsController.getById(req, res, next);
});
moneyRoutes.patch('/debts/:id', (req, res, next) => {
  void debtsController.update(req, res, next);
});
moneyRoutes.delete('/debts/:id', (req, res, next) => {
  void debtsController.remove(req, res, next);
});
moneyRoutes.post('/debts/:id/payments', (req, res, next) => {
  void debtsController.addPayment(req, res, next);
});

// Budgets
moneyRoutes.get('/budgets', (req, res, next) => {
  void budgetsController.list(req, res, next);
});
moneyRoutes.put('/budgets', (req, res, next) => {
  void budgetsController.upsert(req, res, next);
});

// Audit & reminders
moneyRoutes.get('/audit-logs', (req, res, next) => {
  void auditLogsController.list(req, res, next);
});
moneyRoutes.get('/reminders', (req, res, next) => {
  void remindersController.list(req, res, next);
});

export default moneyRoutes;
