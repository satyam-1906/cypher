import logging

# Configure root logger to ignore noisy INFO logs from libraries
logging.basicConfig(
    filename='app.log',
    filemode='a',
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.WARNING,
    force=True
)

# Create a dedicated application logger for your own messages
app_logger = logging.getLogger('CCTVApp')
app_logger.setLevel(logging.INFO)

# Ensure app logger is written to the file and does not propagate to the root logger
if not app_logger.handlers:
    handler = logging.FileHandler('app.log', mode='a', encoding='utf-8')
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(threadName)s - %(message)s')
    handler.setFormatter(formatter)
    app_logger.addHandler(handler)
app_logger.propagate = False

def log_info(name, humans, machines, description):
    app_logger.info(f'Name: {name} - Humans: {humans} - Machines: {machines} - Description: {description}')


def log_error(message):
    app_logger.error(f'Error: {message}')

def log_activation(message):
    app_logger.info(f'Activation state: {message}')

